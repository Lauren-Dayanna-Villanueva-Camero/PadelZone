import Reserva from '../models/reserva.model.js'
import Torneo from '../models/torneo.model.js'

// Utilidades de fechas y franjas horarias compartidas por torneos, solicitudes
// de empresas y reservas. Las fechas son días guardados como medianoche UTC y
// las horas son textos 'HH:mm' (se pueden comparar como texto).

const DIA_MS = 24 * 60 * 60 * 1000
const pad = (n) => String(n).padStart(2, '0')

export const aMinutos = (hora) => {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

export const aHora = (minutos) => `${pad(Math.floor(minutos / 60))}:${pad(minutos % 60)}`

// 'YYYY-MM-DD' de una fecha guardada como medianoche UTC
export const diaKey = (fecha) => (fecha ? new Date(fecha).toISOString().slice(0, 10) : null)

// Días entre dos fechas, ambas incluidas
export const diasEntre = (inicio, fin) => {
  const dias = []
  const hasta = new Date(fin).getTime()
  for (let t = new Date(inicio).getTime(); t <= hasta; t += DIA_MS) dias.push(new Date(t))
  return dias
}

// Turnos de partido que caben en la franja diaria
export const turnosDelDia = (horaInicio, horaFin, duracion) => {
  const turnos = []
  for (let m = aMinutos(horaInicio); m + duracion <= aMinutos(horaFin); m += duracion) {
    turnos.push({ hora_inicio: aHora(m), hora_fin: aHora(m + duracion) })
  }
  return turnos
}

// Partidos que se pueden jugar con esos días, franja y canchas
export const capacidadPartidos = ({ fecha_inicio, fecha_fin, hora_inicio, hora_fin, duracion_partido_min, canchas }) =>
  diasEntre(fecha_inicio, fecha_fin).length *
  turnosDelDia(hora_inicio, hora_fin, duracion_partido_min || 90).length *
  Math.max(canchas?.length ?? 0, 1)

// En eliminación directa se juegan (parejas - 1) partidos; los BYE no se juegan
export const partidosNecesarios = (parejas) => Math.max(parejas - 1, 0)

// Revisa la franja, el periodo de inscripciones y su relación con el inicio del
// torneo. Recibe los valores finales (en un update, lo guardado + lo que cambia).
// Devuelve el mensaje de error o null.
export const errorProgramacion = (t) => {
  if (t.hora_inicio && t.hora_fin) {
    if (t.hora_fin <= t.hora_inicio) return 'La hora de fin debe ser posterior a la hora de inicio'
    if (t.hora_inicio < '07:00' || t.hora_fin > '23:00') return 'El horario de las canchas es de 7:00 a 23:00'
    if (aMinutos(t.hora_fin) - aMinutos(t.hora_inicio) < (t.duracion_partido_min || 90)) {
      return 'La franja diaria debe alcanzar al menos para un partido'
    }
  }

  const apertura = diaKey(t.inscripcion_apertura)
  const cierre = diaKey(t.inscripcion_cierre)
  const inicio = diaKey(t.fecha_inicio)
  if (Boolean(apertura) !== Boolean(cierre)) return 'Indica la apertura y el cierre de las inscripciones'
  if (apertura && cierre < apertura) return 'El cierre de inscripciones no puede ser anterior a la apertura'
  if (cierre && inicio && cierre >= inicio) return 'Las inscripciones deben cerrar antes del día de inicio del torneo'
  return null
}

const ESTADOS_QUE_BLOQUEAN = ['activo', 'en_curso']

// Franjas en las que un torneo aparta la cancha ese día (para el módulo de reservas)
export const bloqueosDeTorneos = async (canchaId, fecha) => {
  const torneos = await Torneo.find({
    estado: { $in: ESTADOS_QUE_BLOQUEAN },
    canchas: canchaId,
    fecha_inicio: { $lte: fecha },
    fecha_fin: { $gte: fecha }
  }).select('nombre hora_inicio hora_fin')
  return torneos.map(t => ({ hora_inicio: t.hora_inicio, hora_fin: t.hora_fin, torneo: t.nombre }))
}

// Reservas y torneos que se cruzan con un bloque (canchas × días × franja).
// Sirve para cotizar una solicitud y para no aprobarla si ya no está libre.
export const conflictosBloque = async ({ canchas, fecha_inicio, fecha_fin, hora_inicio, hora_fin, excluirTorneoId = null }) => {
  if (!canchas?.length) return []
  const ids = canchas.map(c => c.toString())

  const reservas = await Reserva.find({
    cancha_id: { $in: ids },
    fecha: { $gte: fecha_inicio, $lte: fecha_fin },
    estado: { $ne: 'cancelada' },
    hora_inicio: { $lt: hora_fin },
    hora_fin: { $gt: hora_inicio }
  })
    .populate('cancha_id', 'nombre')
    .sort({ fecha: 1, hora_inicio: 1 })

  const torneos = await Torneo.find({
    estado: { $in: ESTADOS_QUE_BLOQUEAN },
    canchas: { $in: ids },
    fecha_inicio: { $lte: fecha_fin },
    fecha_fin: { $gte: fecha_inicio },
    hora_inicio: { $lt: hora_fin },
    hora_fin: { $gt: hora_inicio },
    ...(excluirTorneoId && { _id: { $ne: excluirTorneoId } })
  }).populate('canchas', 'nombre')

  return [
    ...reservas.map(r => ({
      tipo: 'reserva',
      cancha: r.cancha_id?.nombre ?? 'Cancha',
      fecha: r.fecha,
      hora_inicio: r.hora_inicio,
      hora_fin: r.hora_fin,
      detalle: 'Reserva de un usuario'
    })),
    ...torneos.map(t => ({
      tipo: 'torneo',
      cancha: t.canchas.filter(c => ids.includes(c._id.toString())).map(c => c.nombre).join(', '),
      fecha: t.fecha_inicio > fecha_inicio ? t.fecha_inicio : fecha_inicio,
      hora_inicio: t.hora_inicio,
      hora_fin: t.hora_fin,
      detalle: `Torneo "${t.nombre}"`
    }))
  ]
}
