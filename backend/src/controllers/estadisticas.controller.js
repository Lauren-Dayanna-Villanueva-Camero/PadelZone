import Cancha from '../models/cancha.model.js'
import Reserva from '../models/reserva.model.js'
import Pedido from '../models/pedido.model.js'
import PedidoItem from '../models/pedidoItem.model.js'
import User from '../models/user.model.js'
import Pago from '../models/pago.model.js'
import Partido from '../models/partido.model.js'
import SolicitudTorneo from '../models/solicitudTorneo.model.js'
import Multa from '../models/multa.model.js'
import { aMinutos } from '../libs/horarios.js'
import { idsCancelados, vencerReservasPendientes, CONCEPTOS } from '../libs/pagos.js'

// Estadísticas del dashboard del admin. Los días son de Colombia (UTC-5, sin
// horario de verano). Las reservas guardan la fecha como medianoche UTC del día.

const OFFSET = '-05:00'
const DIA_MS = 24 * 60 * 60 * 1000
const HORA_APERTURA = 7
const HORA_CIERRE = 23
const HORAS_POR_DIA = HORA_CIERRE - HORA_APERTURA
export const PERIODOS = [7, 30, 90]

const hoyKey = () => new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
const sumarDias = (key, n) => new Date(new Date(`${key}T00:00:00Z`).getTime() + n * DIA_MS).toISOString().slice(0, 10)
const inicioDia = (key) => new Date(`${key}T00:00:00${OFFSET}`)
const finDia = (key) => new Date(`${key}T23:59:59.999${OFFSET}`)
const fechaUTC = (key) => new Date(`${key}T00:00:00.000Z`)
const listaDias = (desde, n) => Array.from({ length: n }, (_, i) => sumarDias(desde, i))

// Horas que ocupa una reserva (entre la apertura y el cierre del club)
const horasDe = (r) => Math.max(0, (aMinutos(r.hora_fin) - aMinutos(r.hora_inicio)) / 60)

// Ingresos (pagos aprobados) de un rango, agrupados por día y concepto
const ingresosPorDia = (desde, hasta) => Pago.aggregate([
  { $match: { estado: 'aprobado', pagado_en: { $gte: inicioDia(desde), $lte: finDia(hasta) } } },
  {
    $group: {
      _id: {
        dia: { $dateToString: { format: '%Y-%m-%d', date: '$pagado_en', timezone: OFFSET } },
        concepto: '$concepto',
        metodo: '$metodo'
      },
      total: { $sum: '$monto' },
      cantidad: { $sum: 1 }
    }
  }
])

const reservasDelRango = (desde, hasta) => Reserva.find({
  estado: { $ne: 'cancelada' },
  fecha: { $gte: fechaUTC(desde), $lte: fechaUTC(hasta) }
}).select('cancha_id fecha hora_inicio hora_fin precio').lean()

// GET /api/admin/estadisticas?dias=7|30|90 — solo admin
export const getEstadisticas = async (req, res) => {
  try {
    const dias = PERIODOS.includes(Number(req.query.dias)) ? Number(req.query.dias) : 30
    await vencerReservasPendientes()

    const hoy = hoyKey()
    const desde = sumarDias(hoy, -(dias - 1))
    const antDesde = sumarDias(desde, -dias)
    const antHasta = sumarDias(desde, -1)

    const [
      canchas, ingresosAct, ingresosAnt, reservasAct, reservasAnt,
      usuariosAct, usuariosAnt, topProductos, pedidosPeriodo,
      efectivo, pedidosPendientes, solicitudesPendientes, reservasEsperando,
      aprobados, reservasHoy, partidosHoy
    ] = await Promise.all([
      Cancha.find({ activa: true }).select('nombre').sort({ nombre: 1 }).lean(),
      ingresosPorDia(desde, hoy),
      ingresosPorDia(antDesde, antHasta),
      reservasDelRango(desde, hoy),
      reservasDelRango(antDesde, antHasta),
      User.countDocuments({ rol: 'usuario', fecha_registro: { $gte: inicioDia(desde), $lte: finDia(hoy) } }),
      User.countDocuments({ rol: 'usuario', fecha_registro: { $gte: inicioDia(antDesde), $lte: finDia(antHasta) } }),
      PedidoItem.aggregate([
        { $lookup: { from: Pedido.collection.name, localField: 'pedido_id', foreignField: '_id', as: 'pedido' } },
        { $unwind: '$pedido' },
        { $match: { 'pedido.estado': { $ne: 'cancelado' }, 'pedido.fecha_pedido': { $gte: inicioDia(desde), $lte: finDia(hoy) } } },
        { $group: { _id: '$nombre', unidades: { $sum: '$cantidad' }, total: { $sum: { $multiply: ['$cantidad', '$precio_unitario'] } } } },
        { $sort: { unidades: -1, total: -1 } },
        { $limit: 5 }
      ]),
      Pedido.countDocuments({ estado: { $ne: 'cancelado' }, fecha_pedido: { $gte: inicioDia(desde), $lte: finDia(hoy) } }),
      Pago.aggregate([
        { $match: { estado: 'pendiente', proveedor: 'manual' } },
        { $group: { _id: null, cantidad: { $sum: 1 }, monto: { $sum: '$monto' } } }
      ]),
      Pedido.countDocuments({ estado: 'pendiente' }),
      SolicitudTorneo.countDocuments({ estado: 'pendiente' }),
      Reserva.countDocuments({ estado: 'pendiente' }),
      Pago.find({ estado: 'aprobado' }).select('concepto referencia_id').lean(),
      Reserva.find({ estado: { $ne: 'cancelada' }, fecha: fechaUTC(hoy) })
        .populate('cancha_id', 'nombre')
        .populate('usuario_id', 'nombre apellido')
        .select('cancha_id usuario_id hora_inicio hora_fin estado pagada')
        .sort({ hora_inicio: 1 })
        .lean(),
      Partido.countDocuments({ fecha: fechaUTC(hoy) })
    ])

    // Ingresos: serie diaria (periodo actual y anterior, alineados por posición),
    // por concepto y por método
    const diasAct = listaDias(desde, dias)
    const porDia = new Map(diasAct.map(d => [d, 0]))
    const porConcepto = Object.fromEntries(CONCEPTOS.map(c => [c, 0]))
    const porMetodo = {}
    let ingresos = 0
    let pagosAprobados = 0
    for (const g of ingresosAct) {
      porDia.set(g._id.dia, (porDia.get(g._id.dia) ?? 0) + g.total)
      porConcepto[g._id.concepto] = (porConcepto[g._id.concepto] ?? 0) + g.total
      porMetodo[g._id.metodo] = (porMetodo[g._id.metodo] ?? 0) + g.total
      ingresos += g.total
      pagosAprobados += g.cantidad
    }
    const porDiaAnt = new Map(listaDias(antDesde, dias).map(d => [d, 0]))
    let ingresosAnterior = 0
    for (const g of ingresosAnt) {
      porDiaAnt.set(g._id.dia, (porDiaAnt.get(g._id.dia) ?? 0) + g.total)
      ingresosAnterior += g.total
    }
    const serieAnt = [...porDiaAnt.values()]

    // Reservas por día y ocupación (horas reservadas / horas disponibles)
    const reservasPorDia = new Map(diasAct.map(d => [d, 0]))
    for (const r of reservasAct) {
      const d = r.fecha.toISOString().slice(0, 10)
      reservasPorDia.set(d, (reservasPorDia.get(d) ?? 0) + 1)
    }
    const capacidad = canchas.length * HORAS_POR_DIA * dias
    const horasAct = reservasAct.reduce((s, r) => s + horasDe(r), 0)
    const horasAnt = reservasAnt.reduce((s, r) => s + horasDe(r), 0)
    const pct = (h) => (capacidad ? Math.round((h / capacidad) * 1000) / 10 : 0)

    // Mapa de calor: día de la semana × hora, en % de la capacidad de esa celda
    const diasSemana = Array(7).fill(0) // cuántos lunes, martes... hay en el periodo
    for (const d of diasAct) diasSemana[(new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7]++
    const celdas = Array.from({ length: 7 }, () => Array(HORAS_POR_DIA).fill(0))
    for (const r of reservasAct) {
      const dow = (r.fecha.getUTCDay() + 6) % 7 // 0 = lunes
      const ini = aMinutos(r.hora_inicio)
      const fin = aMinutos(r.hora_fin)
      for (let h = HORA_APERTURA; h < HORA_CIERRE; h++) {
        // Fracción de la hora h que ocupa la reserva (por si empieza a la media)
        const ocupado = Math.max(0, Math.min(fin, (h + 1) * 60) - Math.max(ini, h * 60)) / 60
        celdas[dow][h - HORA_APERTURA] += ocupado
      }
    }
    const heatmap = celdas.map((fila, dow) => fila.map((horas, i) => {
      const cap = canchas.length * diasSemana[dow]
      return { horas: Math.round(horas * 10) / 10, pct: cap ? Math.round((horas / cap) * 100) : 0, hora: HORA_APERTURA + i }
    }))

    // Ocupación por cancha
    const horasPorCancha = new Map()
    for (const r of reservasAct) {
      const k = String(r.cancha_id)
      horasPorCancha.set(k, (horasPorCancha.get(k) ?? 0) + horasDe(r))
    }
    const capCancha = HORAS_POR_DIA * dias
    const ocupacionCanchas = canchas
      .map(c => {
        const horas = horasPorCancha.get(String(c._id)) ?? 0
        return { _id: c._id, nombre: c.nombre, horas, capacidad: capCancha, pct: Math.round((horas / capCancha) * 1000) / 10 }
      })
      .sort((a, b) => b.pct - a.pct)

    // Pagos aprobados de cosas canceladas: hay que devolver el dinero
    let porReembolsar = 0
    for (const c of CONCEPTOS) {
      const ids = aprobados.filter(p => p.concepto === c).map(p => p.referencia_id)
      porReembolsar += (await idsCancelados(c, ids)).size
    }

    const multasPendientes = await Multa.aggregate([
      { $match: { estado: 'pendiente' } },
      { $group: { _id: null, cantidad: { $sum: 1 }, monto: { $sum: '$monto' } } }
    ])

    return res.status(200).json({
      periodo: { dias, desde, hasta: hoy, anterior: { desde: antDesde, hasta: antHasta } },
      kpis: {
        ingresos: { actual: ingresos, anterior: ingresosAnterior },
        reservas: { actual: reservasAct.length, anterior: reservasAnt.length },
        ocupacion: { actual: pct(horasAct), anterior: pct(horasAnt) },
        usuarios_nuevos: { actual: usuariosAct, anterior: usuariosAnt },
        ticket_promedio: pagosAprobados ? Math.round(ingresos / pagosAprobados) : 0,
        pedidos: pedidosPeriodo
      },
      serie: diasAct.map((dia, i) => ({
        dia,
        ingresos: porDia.get(dia) ?? 0,
        ingresos_anterior: serieAnt[i] ?? 0,
        reservas: reservasPorDia.get(dia) ?? 0
      })),
      ingresos_por_concepto: CONCEPTOS
        .map(c => ({ concepto: c, total: porConcepto[c] ?? 0 }))
        .sort((a, b) => b.total - a.total),
      ingresos_por_metodo: Object.entries(porMetodo)
        .map(([metodo, total]) => ({ metodo, total }))
        .sort((a, b) => b.total - a.total),
      heatmap: { horas: Array.from({ length: HORAS_POR_DIA }, (_, i) => HORA_APERTURA + i), filas: heatmap },
      ocupacion_canchas: ocupacionCanchas,
      top_productos: topProductos.map(p => ({ nombre: p._id, unidades: p.unidades, total: p.total })),
      pendientes: {
        efectivo: { cantidad: efectivo[0]?.cantidad ?? 0, monto: efectivo[0]?.monto ?? 0 },
        reembolsos: porReembolsar,
        pedidos: pedidosPendientes,
        solicitudes: solicitudesPendientes,
        reservas_esperando_pago: reservasEsperando,
        multas: { cantidad: multasPendientes[0]?.cantidad ?? 0, monto: multasPendientes[0]?.monto ?? 0 }
      },
      hoy: {
        dia: hoy,
        partidos: partidosHoy,
        reservas: reservasHoy.map(r => ({
          _id: r._id,
          hora_inicio: r.hora_inicio,
          hora_fin: r.hora_fin,
          cancha: r.cancha_id?.nombre ?? 'Cancha',
          cliente: r.usuario_id ? `${r.usuario_id.nombre} ${r.usuario_id.apellido ?? ''}`.trim() : 'Usuario eliminado',
          estado: r.estado,
          pagada: Boolean(r.pagada)
        }))
      }
    })
  } catch (error) {
    console.error('Error en getEstadisticas:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}
