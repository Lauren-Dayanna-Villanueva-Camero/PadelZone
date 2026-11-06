import SolicitudTorneo from '../models/solicitudTorneo.model.js'
import Torneo from '../models/torneo.model.js'
import { solicitudSchema, cotizacionSchema, respuestaSchema, rechazoSchema } from '../schema/solicitud.schema.js'
import { inicioDeHoy } from '../libs/torneos.js'
import { errorProgramacion, conflictosBloque, diaKey } from '../libs/horarios.js'
import { cotizarSolicitud, fechasSolicitud, convenioVigente } from '../libs/solicitudes.js'

const datosInvalidos = (res, parsed) => res.status(400).json({
  message: 'Datos inválidos',
  errors: parsed.error.issues.map(e => e.message)
})

// Valida el formulario y las reglas de fechas. Devuelve { datos } o { error }
const leerSolicitud = (body, schema = solicitudSchema) => {
  const parsed = schema.safeParse(body ?? {})
  if (!parsed.success) return { parsed }

  const datos = fechasSolicitud(parsed.data)
  const error = errorProgramacion(datos)
  if (error) return { error }
  if (datos.inscripcion_apertura < inicioDeHoy()) {
    return { error: 'La apertura de inscripciones no puede ser una fecha pasada' }
  }
  return { datos }
}

const poblar = (query) => query
  .populate('solicitante_id', 'nombre apellido email telefono')
  .populate('canchas', 'nombre precio_por_hora')
  .populate('torneo_id', 'nombre estado')

// POST /api/solicitudes-torneo/cotizar — calcula el costo y revisa disponibilidad sin guardar
export const cotizar = async (req, res) => {
  try {
    const { parsed, error, datos } = leerSolicitud(req.body, cotizacionSchema)
    if (parsed) return datosInvalidos(res, parsed)
    if (error) return res.status(400).json({ message: error, errors: [error] })

    const cotizacion = await cotizarSolicitud(datos, req.user._id)
    return res.status(200).json(cotizacion)
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message })
    console.error('Error en cotizar:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// POST /api/solicitudes-torneo — la empresa envía su solicitud (queda pendiente)
export const createSolicitud = async (req, res) => {
  try {
    const { parsed, error, datos } = leerSolicitud(req.body)
    if (parsed) return datosInvalidos(res, parsed)
    if (error) return res.status(400).json({ message: error, errors: [error] })

    // Con un convenio vigente se usa ese; si no, un convenio nuevo necesita su duración
    const vigente = await convenioVigente(req.user._id)
    if (!vigente && datos.modalidad === 'convenio' && !datos.convenio_meses) {
      return res.status(400).json({ message: 'Elige la duración del convenio (3, 6 o 12 meses)' })
    }

    const cotizacion = await cotizarSolicitud(datos, req.user._id)
    if (cotizacion.conflictos.length) {
      return res.status(409).json({
        message: 'Las canchas elegidas no están libres en ese horario. Cambia las canchas, los días o la franja.',
        conflictos: cotizacion.conflictos
      })
    }
    const { partidos_posibles: posibles, partidos_necesarios: necesarios } = cotizacion.capacidad
    if (posibles < necesarios) {
      return res.status(400).json({
        message: `Con esos días, horario y canchas caben ${posibles} partidos y el torneo necesita ${necesarios}. Agrega canchas, horas o días.`
      })
    }

    const solicitud = await SolicitudTorneo.create({
      ...datos,
      solicitante_id: req.user._id,
      modalidad: vigente ? 'convenio' : datos.modalidad,
      convenio_meses: vigente || datos.modalidad !== 'convenio' ? null : datos.convenio_meses,
      convenio_origen_id: vigente?._id ?? null,
      costo: cotizacion.costo
    })

    return res.status(201).json({
      message: 'Solicitud enviada. PadelZone la revisará y te responderá por este medio.',
      solicitud: await poblar(SolicitudTorneo.findById(solicitud._id))
    })
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message })
    console.error('Error en createSolicitud:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// GET /api/solicitudes-torneo/mias — solicitudes del usuario y su convenio vigente
export const getMisSolicitudes = async (req, res) => {
  try {
    const solicitudes = await poblar(SolicitudTorneo.find({ solicitante_id: req.user._id }))
      .sort({ createdAt: -1 })
    const vigente = await convenioVigente(req.user._id)

    return res.status(200).json({
      solicitudes,
      convenio_vigente: vigente
        ? { _id: vigente._id, meses: vigente.convenio_meses, vigente_hasta: vigente.convenio_vigente_hasta }
        : null
    })
  } catch (error) {
    console.error('Error en getMisSolicitudes:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// PUT /api/solicitudes-torneo/:id/cancelar — el solicitante la retira mientras está pendiente
export const cancelarSolicitud = async (req, res) => {
  try {
    const solicitud = await SolicitudTorneo.findOneAndUpdate(
      { _id: req.params.id, solicitante_id: req.user._id, estado: 'pendiente' },
      { estado: 'cancelada' },
      { new: true }
    )
    if (!solicitud) {
      return res.status(404).json({ message: 'No hay una solicitud pendiente tuya con ese id' })
    }
    return res.status(200).json({ message: 'Solicitud cancelada', solicitud })
  } catch (error) {
    console.error('Error en cancelarSolicitud:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// GET /api/solicitudes-torneo — solo admin: todas, primero las pendientes
export const getSolicitudes = async (req, res) => {
  try {
    const solicitudes = await poblar(SolicitudTorneo.find()).sort({ createdAt: -1 })
    const pendientePrimero = (s) => (s.estado === 'pendiente' ? 0 : 1)
    solicitudes.sort((a, b) => pendientePrimero(a) - pendientePrimero(b))

    // Disponibilidad actual de las pendientes (pudo cambiar desde que se enviaron)
    const respuesta = await Promise.all(solicitudes.map(async (s) => ({
      ...s.toObject(),
      conflictos: s.estado === 'pendiente'
        ? await conflictosBloque({ ...s.toObject(), canchas: s.canchas.map(c => c._id) })
        : []
    })))

    return res.status(200).json(respuesta)
  } catch (error) {
    console.error('Error en getSolicitudes:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// PUT /api/solicitudes-torneo/:id/aprobar — solo admin: crea el torneo y aparta las canchas
export const aprobarSolicitud = async (req, res) => {
  try {
    const parsed = respuestaSchema.safeParse(req.body ?? {})
    if (!parsed.success) return datosInvalidos(res, parsed)

    const actual = await SolicitudTorneo.findById(req.params.id)
    if (!actual) {
      return res.status(404).json({ message: 'Solicitud no encontrada' })
    }
    if (actual.estado !== 'pendiente') {
      return res.status(400).json({ message: 'Solo se pueden aprobar solicitudes pendientes' })
    }
    if (actual.inscripcion_cierre < inicioDeHoy()) {
      return res.status(400).json({
        message: `El cierre de inscripciones (${diaKey(actual.inscripcion_cierre)}) ya pasó; rechaza la solicitud y pide nuevas fechas`
      })
    }

    const conflictos = await conflictosBloque({ ...actual.toObject(), canchas: actual.canchas })
    if (conflictos.length) {
      return res.status(409).json({
        message: 'Las canchas ya no están libres en ese horario; rechaza la solicitud o libera esas reservas',
        conflictos
      })
    }

    // Se marca como aprobada de forma atómica: si dos admins aprueban a la vez, solo uno crea el torneo
    const solicitud = await SolicitudTorneo.findOneAndUpdate(
      { _id: actual._id, estado: 'pendiente' },
      { estado: 'aprobada', respuesta_admin: parsed.data.respuesta ?? '' },
      { new: true }
    )
    if (!solicitud) {
      return res.status(409).json({ message: 'La solicitud ya cambió de estado, recarga la página' })
    }

    let torneo
    try {
      torneo = await Torneo.create({
        nombre: solicitud.nombre_torneo,
        tipo_torneo: solicitud.tipo_torneo,
        fecha_inicio: solicitud.fecha_inicio,
        fecha_fin: solicitud.fecha_fin,
        cupo_maximo_parejas: solicitud.cupo_maximo_parejas,
        precio_inscripcion: solicitud.precio_inscripcion,
        estado: 'activo',
        inscripcion_apertura: solicitud.inscripcion_apertura,
        inscripcion_cierre: solicitud.inscripcion_cierre,
        hora_inicio: solicitud.hora_inicio,
        hora_fin: solicitud.hora_fin,
        duracion_partido_min: solicitud.duracion_partido_min,
        canchas: solicitud.canchas,
        organizador: solicitud.empresa.nombre,
        solicitud_id: solicitud._id
      })
    } catch (error) {
      await SolicitudTorneo.updateOne({ _id: solicitud._id }, { estado: 'pendiente', respuesta_admin: '' })
      throw error
    }

    solicitud.torneo_id = torneo._id
    // Un convenio nuevo empieza a contar desde la aprobación
    if (solicitud.convenio_meses) {
      const hasta = inicioDeHoy()
      hasta.setUTCMonth(hasta.getUTCMonth() + solicitud.convenio_meses)
      solicitud.convenio_vigente_hasta = hasta
    }
    await solicitud.save()

    return res.status(200).json({
      message: `Solicitud aprobada: se creó el torneo "${torneo.nombre}" y las canchas quedaron apartadas`,
      solicitud: await poblar(SolicitudTorneo.findById(solicitud._id)),
      torneo
    })
  } catch (error) {
    console.error('Error en aprobarSolicitud:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// PUT /api/solicitudes-torneo/:id/rechazar — solo admin, con el motivo
export const rechazarSolicitud = async (req, res) => {
  try {
    const parsed = rechazoSchema.safeParse(req.body ?? {})
    if (!parsed.success) return datosInvalidos(res, parsed)

    const solicitud = await SolicitudTorneo.findOneAndUpdate(
      { _id: req.params.id, estado: 'pendiente' },
      { estado: 'rechazada', respuesta_admin: parsed.data.respuesta },
      { new: true }
    )
    if (!solicitud) {
      return res.status(404).json({ message: 'No hay una solicitud pendiente con ese id' })
    }

    return res.status(200).json({
      message: 'Solicitud rechazada',
      solicitud: await poblar(SolicitudTorneo.findById(solicitud._id))
    })
  } catch (error) {
    console.error('Error en rechazarSolicitud:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}
