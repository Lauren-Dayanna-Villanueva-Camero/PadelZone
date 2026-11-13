import Multa from '../models/multa.model.js'
import Reserva from '../models/reserva.model.js'
import Pago from '../models/pago.model.js'
import { diaKey } from './horarios.js'
import { MULTA_PORCENTAJE, MULTA_LIMITE_INASISTENCIAS, MULTA_DIAS_HISTORIAL } from '../config.js'

// Inasistencias: si alguien reserva para pagar en la sede y no llega, la cancha
// quedó apartada sin que nadie la usara. El admin lo marca en Reservas y:
// 1. se le cobra una multa (MULTA_PORCENTAJE % del precio de la reserva);
// 2. mientras tenga multas sin pagar no puede hacer reservas nuevas;
// 3. con MULTA_LIMITE_INASISTENCIAS o más en los últimos MULTA_DIAS_HISTORIAL
//    días, sus reservas ya no se pueden pagar en la sede, solo en línea.

const errorMulta = (status, message) => Object.assign(new Error(message), { status })

export const reglasMultas = () => ({
  porcentaje: MULTA_PORCENTAJE,
  limite_inasistencias: MULTA_LIMITE_INASISTENCIAS,
  dias_historial: MULTA_DIAS_HISTORIAL
})

// Hora de inicio de la reserva (las horas son de Colombia, UTC-5)
export const inicioReserva = (r) => new Date(`${diaKey(r.fecha)}T${r.hora_inicio}:00-05:00`)

export const montoMulta = (precio) => Math.round((precio * MULTA_PORCENTAJE) / 100)

// Situación del usuario: multas pendientes, inasistencias recientes y si
// todavía puede pagar reservas en la sede
export const estadoMultas = async (usuarioId) => {
  const desde = new Date(Date.now() - MULTA_DIAS_HISTORIAL * 24 * 60 * 60 * 1000)
  const [pendientes, inasistencias] = await Promise.all([
    Multa.find({ usuario_id: usuarioId, estado: 'pendiente' }).sort({ createdAt: 1 }).lean(),
    // Las multas anuladas (perdonadas) no cuentan
    Multa.countDocuments({ usuario_id: usuarioId, estado: { $ne: 'anulada' }, createdAt: { $gte: desde } })
  ])
  return {
    pendientes,
    total_pendiente: pendientes.reduce((s, m) => s + m.monto, 0),
    inasistencias,
    solo_en_linea: inasistencias >= MULTA_LIMITE_INASISTENCIAS,
    reglas: reglasMultas()
  }
}

// Los pagos pendientes de algo que ya no se va a pagar quedan anulados
const anularPagosPendientes = (concepto, id, mensaje) => Pago.updateMany(
  { concepto, referencia_id: id, estado: 'pendiente', proveedor: { $ne: 'wompi' } },
  { estado: 'anulado', mensaje }
)

// El admin marca que el usuario no llegó. Devuelve { reserva, multa }
export const registrarInasistencia = async (reservaId, adminId) => {
  const reserva = await Reserva.findById(reservaId).populate('cancha_id', 'nombre')
  if (!reserva) throw errorMulta(404, 'Reserva no encontrada')
  if (reserva.no_asistio) throw errorMulta(409, 'Esta reserva ya está marcada como inasistencia')
  if (reserva.estado !== 'confirmada') throw errorMulta(400, 'Solo se marcan las reservas confirmadas')
  if (reserva.pagada) {
    throw errorMulta(400, 'La reserva ya está pagada: la cancha se cobró aunque no hayan venido, no hace falta multa')
  }
  if (inicioReserva(reserva) > new Date()) {
    throw errorMulta(400, 'La reserva todavía no ha empezado')
  }

  const monto = montoMulta(reserva.precio)
  const descripcion = `Multa por no asistir · ${reserva.cancha_id?.nombre ?? 'Cancha'} · ${diaKey(reserva.fecha)} · ${reserva.hora_inicio}–${reserva.hora_fin}`
  // Si antes se había marcado y se deshizo, se reutiliza la misma multa
  const multa = await Multa.findOneAndUpdate(
    { reserva_id: reserva._id },
    {
      usuario_id: reserva.usuario_id,
      monto,
      descripcion,
      estado: 'pendiente',
      motivo_anulacion: '',
      pagada_en: null,
      registrada_por: adminId
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )

  reserva.no_asistio = true
  reserva.multa_id = multa._id
  await reserva.save()
  // El pago en efectivo que quedó registrado ya no se va a cobrar
  await anularPagosPendientes('reserva', reserva._id, 'No asistió a la reserva')

  return { reserva, multa }
}

// El admin se equivocó al marcarla: la multa queda anulada
export const quitarInasistencia = async (reservaId) => {
  const reserva = await Reserva.findById(reservaId)
  if (!reserva) throw errorMulta(404, 'Reserva no encontrada')
  if (!reserva.no_asistio) throw errorMulta(400, 'Esta reserva no está marcada como inasistencia')

  const multa = await Multa.findOne({ reserva_id: reserva._id })
  if (multa?.estado === 'pagada') {
    throw errorMulta(409, 'La multa ya se pagó: primero anula ese pago en Pagos (registrar reembolso)')
  }
  if (multa && multa.estado === 'pendiente') {
    multa.estado = 'anulada'
    multa.motivo_anulacion = 'Se corrigió: el usuario sí asistió'
    await multa.save()
    await anularPagosPendientes('multa', multa._id, 'La multa fue anulada')
  }

  reserva.no_asistio = false
  reserva.multa_id = null
  await reserva.save()
  return reserva
}

// El admin perdona una multa pendiente (la inasistencia queda registrada)
export const anularMulta = async (multaId, motivo) => {
  const multa = await Multa.findById(multaId)
  if (!multa) throw errorMulta(404, 'Multa no encontrada')
  if (multa.estado !== 'pendiente') {
    throw errorMulta(400, multa.estado === 'pagada'
      ? 'La multa ya se pagó: para devolver el dinero anula su pago en Pagos'
      : 'La multa ya está anulada')
  }
  multa.estado = 'anulada'
  multa.motivo_anulacion = motivo
  await multa.save()
  await anularPagosPendientes('multa', multa._id, 'La multa fue anulada')
  return multa
}
