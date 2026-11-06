import Cancha from '../models/cancha.model.js'
import SolicitudTorneo from '../models/solicitudTorneo.model.js'
import { inicioDeHoy } from './torneos.js'
import {
  aMinutos,
  diasEntre,
  capacidadPartidos,
  partidosNecesarios,
  conflictosBloque
} from './horarios.js'

// Descuento (%) según la duración del convenio, en meses
export const DESCUENTO_CONVENIO = { 3: 10, 6: 15, 12: 20 }

// Convenio aprobado y vigente del usuario (el más largo si hay varios)
export const convenioVigente = (usuarioId) =>
  SolicitudTorneo.findOne({
    solicitante_id: usuarioId,
    estado: 'aprobada',
    convenio_meses: { $ne: null },
    convenio_vigente_hasta: { $gte: inicioDeHoy() }
  }).sort({ convenio_vigente_hasta: -1 })

// Convierte los días 'YYYY-MM-DD' del formulario a medianoche UTC
export const fechasSolicitud = (d) => ({
  ...d,
  fecha_inicio: new Date(d.fecha_inicio),
  fecha_fin: new Date(d.fecha_fin),
  inscripcion_apertura: new Date(d.inscripcion_apertura),
  inscripcion_cierre: new Date(d.inscripcion_cierre),
  duracion_partido_min: d.duracion_partido_min ?? 90
})

// Cotización de un alquiler por bloque: cada cancha elegida se cobra por hora
// durante la franja diaria de todos los días del torneo. Con convenio (nuevo o
// vigente) se aplica su descuento. Devuelve también la capacidad (cuántos
// partidos caben) y los cruces con reservas u otros torneos.
// Lanza un Error con `status` si alguna cancha no existe o está inactiva.
export const cotizarSolicitud = async (datos, usuarioId) => {
  const ids = [...new Set(datos.canchas.map(String))]
  const canchas = await Cancha.find({ _id: { $in: ids }, activa: true }).select('nombre precio_por_hora')
  if (canchas.length !== ids.length) {
    const error = new Error('Alguna de las canchas elegidas no existe o está inactiva')
    error.status = 400
    throw error
  }

  const dias = diasEntre(datos.fecha_inicio, datos.fecha_fin).length
  const horasPorDia = (aMinutos(datos.hora_fin) - aMinutos(datos.hora_inicio)) / 60
  const valorHora = canchas.reduce((suma, c) => suma + c.precio_por_hora, 0)
  const subtotal = Math.round(valorHora * horasPorDia * dias)

  const vigente = usuarioId ? await convenioVigente(usuarioId) : null
  const descuentoPct = vigente
    ? DESCUENTO_CONVENIO[vigente.convenio_meses] ?? 0
    : datos.modalidad === 'convenio' ? DESCUENTO_CONVENIO[datos.convenio_meses] ?? 0 : 0
  const descuento = Math.round(subtotal * descuentoPct / 100)

  const conflictos = await conflictosBloque({ ...datos, canchas: ids })

  return {
    canchas: canchas.map(c => ({ _id: c._id, nombre: c.nombre, precio_por_hora: c.precio_por_hora })),
    costo: {
      dias,
      horas_por_dia: horasPorDia,
      horas_cancha: horasPorDia * dias * canchas.length,
      valor_hora: valorHora,
      subtotal,
      descuento_pct: descuentoPct,
      descuento,
      total: subtotal - descuento
    },
    convenio_vigente: vigente
      ? {
          _id: vigente._id,
          meses: vigente.convenio_meses,
          descuento_pct: DESCUENTO_CONVENIO[vigente.convenio_meses] ?? 0,
          vigente_hasta: vigente.convenio_vigente_hasta
        }
      : null,
    capacidad: {
      partidos_posibles: capacidadPartidos({ ...datos, canchas: ids }),
      partidos_necesarios: partidosNecesarios(datos.cupo_maximo_parejas)
    },
    conflictos
  }
}
