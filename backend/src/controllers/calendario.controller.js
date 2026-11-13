import mongoose from 'mongoose'
import Reserva from '../models/reserva.model.js'
import Partido from '../models/partido.model.js'
import Torneo from '../models/torneo.model.js'
import Participante from '../models/participante.model.js'
import InscripcionClase from '../models/inscripcionClase.model.js'
import { obtenerOrganizacion, obtenerMisPartidos, actualizarEstadosTorneos } from '../libs/torneos.js'
import { diaKey, aMinutos, aHora } from '../libs/horarios.js'
import { DURACION_CLASES, diasDeClase, horaDeClase } from '../libs/clases.js'
import { vencerReservasPendientes } from '../libs/pagos.js'

// Calendario: reservas, partidos de torneo, torneos (varios días) y clases en un
// rango de fechas. El admin ve todo el club; un usuario, solo lo suyo.
// Cada evento: { id, tipo, titulo, subtitulo, fecha, fecha_fin?, hora_inicio?,
// hora_fin?, cancha?, estado, ... }. Las fechas son 'YYYY-MM-DD'.

const DIA_MS = 24 * 60 * 60 * 1000
const MAX_DIAS = 62
const esDia = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v ?? '')
const nombre = (u) => (u ? `${u.nombre} ${u.apellido ?? ''}`.trim() : 'Usuario eliminado')
const cancha = (c) => (c ? { _id: c._id, nombre: c.nombre } : null)

const eventoReserva = (r, admin) => ({
  id: `reserva-${r._id}`,
  tipo: 'reserva',
  ref_id: r._id,
  titulo: admin ? `Reserva · ${nombre(r.usuario_id)}` : `Reserva ${r.cancha_id?.nombre ?? ''}`.trim(),
  subtitulo: r.cancha_id?.nombre ?? 'Cancha eliminada',
  fecha: diaKey(r.fecha),
  hora_inicio: r.hora_inicio,
  hora_fin: r.hora_fin,
  cancha: cancha(r.cancha_id),
  estado: r.estado,
  pagada: r.pagada,
  precio: r.precio,
  ...(admin && { usuario: r.usuario_id ? { nombre: nombre(r.usuario_id), email: r.usuario_id.email } : null })
})

const eventoTorneo = (t) => ({
  id: `torneo-${t._id}`,
  tipo: 'torneo',
  ref_id: t._id,
  titulo: t.nombre,
  subtitulo: t.organizador ? `Organiza: ${t.organizador}` : `Torneo ${t.tipo_torneo}`,
  fecha: diaKey(t.fecha_inicio),
  fecha_fin: diaKey(t.fecha_fin),
  hora_inicio: t.hora_inicio,
  hora_fin: t.hora_fin,
  canchas: (t.canchas ?? []).filter(Boolean).map(cancha),
  estado: t.estado,
  privado: t.privado
})

// Clases del usuario: se repiten cada semana en sus días, desde que se inscribió
const eventosClase = (ins, desde, hasta) => {
  const dias = diasDeClase(ins.dias)
  const inicio = horaDeClase(ins.horario)
  if (!dias.length || !inicio) return []
  const fin = aHora(Math.min(aMinutos(inicio) + (DURACION_CLASES[ins.clase_id] ?? 1) * 60, 23 * 60 + 59))
  const primerDia = Math.max(new Date(desde).getTime(), new Date(diaKey(ins.fecha_inscripcion)).getTime())
  const eventos = []
  for (let t = primerDia; t <= new Date(hasta).getTime(); t += DIA_MS) {
    const dia = new Date(t)
    if (!dias.includes(dia.getUTCDay())) continue
    const fecha = diaKey(dia)
    eventos.push({
      id: `clase-${ins._id}-${fecha}`,
      tipo: 'clase',
      ref_id: ins._id,
      titulo: `Clase ${ins.clase_nombre}`,
      subtitulo: [ins.grupo, ins.profesor].filter(Boolean).join(' · '),
      fecha,
      hora_inicio: inicio,
      hora_fin: fin,
      estado: ins.estado,
      color: ins.color
    })
  }
  return eventos
}

// Partidos programados de varios torneos, con los nombres de cada pareja
const eventosPartidos = async (partidos) => {
  const torneoIds = [...new Set(partidos.map(p => String(p.torneo_id?._id ?? p.torneo_id)))]
  const nombresPorTorneo = new Map()
  for (const id of torneoIds) {
    const { equipos } = await obtenerOrganizacion(id)
    nombresPorTorneo.set(id, new Map(equipos.map(e => [e.equipo, e.integrantes.map(i => i.nombre).join(' / ')])))
  }
  const pareja = (torneoId, numero) => (numero == null
    ? 'Por definir'
    : nombresPorTorneo.get(torneoId)?.get(numero) || `Pareja #${numero}`)

  return partidos
    .filter(p => p.equipo_a != null && p.equipo_b != null) // los BYE no se juegan
    .map(p => {
      const torneoId = String(p.torneo_id?._id ?? p.torneo_id)
      return {
        id: `partido-${p._id}`,
        tipo: 'partido',
        ref_id: p._id,
        torneo: { _id: torneoId, nombre: p.torneo_id?.nombre ?? 'Torneo' },
        titulo: `#${p.equipo_a} vs #${p.equipo_b} · ${p.torneo_id?.nombre ?? 'Torneo'}`,
        subtitulo: `${pareja(torneoId, p.equipo_a)} vs ${pareja(torneoId, p.equipo_b)}`,
        fecha: diaKey(p.fecha),
        hora_inicio: p.hora_inicio,
        hora_fin: p.hora_fin,
        cancha: cancha(p.cancha_id),
        estado: p.ganador != null ? 'jugado' : 'pendiente',
        ganador: p.ganador
      }
    })
}

// GET /api/calendario?desde=YYYY-MM-DD&hasta=YYYY-MM-DD[&cancha_id=] (cancha_id solo admin)
export const getCalendario = async (req, res) => {
  try {
    const { desde, hasta, cancha_id: canchaId } = req.query
    if (!esDia(desde) || !esDia(hasta) || hasta < desde) {
      return res.status(400).json({ message: 'Indica desde y hasta (YYYY-MM-DD)' })
    }
    const inicio = new Date(desde)
    const fin = new Date(hasta)
    if ((fin - inicio) / DIA_MS > MAX_DIAS) {
      return res.status(400).json({ message: `El rango máximo es de ${MAX_DIAS} días` })
    }

    await Promise.all([vencerReservasPendientes(), actualizarEstadosTorneos()])
    const admin = req.user.rol === 'admin'
    const enRango = { $gte: inicio, $lte: fin }
    const filtroCancha = admin && mongoose.isValidObjectId(canchaId) ? canchaId : null
    let eventos = []

    if (admin) {
      const reservas = await Reserva.find({
        fecha: enRango,
        estado: { $ne: 'cancelada' },
        ...(filtroCancha && { cancha_id: filtroCancha })
      })
        .populate('usuario_id', 'nombre apellido email')
        .populate('cancha_id', 'nombre')
      eventos.push(...reservas.map(r => eventoReserva(r, true)))

      const partidos = await Partido.find({ fecha: enRango, ...(filtroCancha && { cancha_id: filtroCancha }) })
        .populate('torneo_id', 'nombre estado')
        .populate('cancha_id', 'nombre')
      eventos.push(...await eventosPartidos(partidos.filter(p => p.torneo_id?.estado !== 'cancelado')))

      const torneos = await Torneo.find({
        estado: { $ne: 'cancelado' },
        fecha_inicio: { $lte: fin },
        fecha_fin: { $gte: inicio },
        ...(filtroCancha && { canchas: filtroCancha })
      }).populate('canchas', 'nombre')
      eventos.push(...torneos.map(eventoTorneo))
    } else {
      const reservas = await Reserva.find({ usuario_id: req.user._id, fecha: enRango, estado: { $ne: 'cancelada' } })
        .populate('cancha_id', 'nombre')
      eventos.push(...reservas.map(r => eventoReserva(r, false)))

      // Partidos donde juega el usuario (ya traen los nombres del rival)
      const mios = await obtenerMisPartidos(req.user._id)
      for (const p of mios) {
        const fecha = diaKey(p.horario?.fecha)
        if (!fecha || fecha < desde || fecha > hasta) continue
        eventos.push({
          id: `partido-${p.partido_id}`,
          tipo: 'partido',
          ref_id: p.partido_id,
          torneo: p.torneo,
          titulo: `${p.ronda} · ${p.torneo.nombre}`,
          subtitulo: p.rival ? `Contra ${p.rival.nombres?.join(' / ') || `pareja #${p.rival.equipo}`}` : 'Rival por definir',
          fecha,
          hora_inicio: p.horario.hora_inicio,
          hora_fin: p.horario.hora_fin,
          cancha: p.horario.cancha,
          estado: p.resultado === 'pendiente' ? 'pendiente' : 'jugado',
          resultado: p.resultado
        })
      }

      const registros = await Participante.find({
        $or: [{ usuario_id: req.user._id }, { pareja_usuario_id: req.user._id }]
      }).distinct('torneo_id')
      const torneos = await Torneo.find({
        _id: { $in: registros },
        estado: { $ne: 'cancelado' },
        fecha_inicio: { $lte: fin },
        fecha_fin: { $gte: inicio }
      }).populate('canchas', 'nombre')
      eventos.push(...torneos.map(eventoTorneo))

      const clases = await InscripcionClase.find({ usuario_id: req.user._id, estado: 'confirmada' })
      for (const ins of clases) eventos.push(...eventosClase(ins, desde, hasta))
    }

    const orden = (e) => `${e.fecha} ${e.tipo === 'torneo' ? '00:00' : e.hora_inicio ?? '99:99'}`
    eventos = eventos.sort((a, b) => orden(a).localeCompare(orden(b)))
    return res.status(200).json({ desde, hasta, eventos })
  } catch (error) {
    console.error('Error en getCalendario:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}
