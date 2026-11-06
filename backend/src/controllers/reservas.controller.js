import mongoose from 'mongoose'
import Reserva from '../models/reserva.model.js'
import Cancha from '../models/cancha.model.js'
import { reservaSchema } from '../schema/reserva.schema.js'
import { bloqueosDeTorneos } from '../libs/horarios.js'

// GET /api/reservas/ocupados?cancha_id=...&fecha=YYYY-MM-DD — público
// Devuelve solo los rangos ocupados, sin datos de usuarios. Incluye las franjas
// que un torneo tiene apartadas en esa cancha (alquiler por bloque)
export const getHorariosOcupados = async (req, res) => {
  try {
    const { cancha_id, fecha } = req.query

    if (!mongoose.isValidObjectId(cancha_id) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) {
      return res.status(400).json({ message: 'Parámetros cancha_id y fecha requeridos' })
    }

    const ocupados = await Reserva.find({
      cancha_id,
      fecha: new Date(fecha),
      estado: { $ne: 'cancelada' }
    }).select('hora_inicio hora_fin -_id')
    const torneos = await bloqueosDeTorneos(cancha_id, new Date(fecha))

    return res.status(200).json([...ocupados.map(o => o.toObject()), ...torneos])
  } catch (error) {
    console.error('Error en getHorariosOcupados:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// GET /api/reservas — admin ve todas, usuario ve las suyas
export const getReservas = async (req, res) => {
  try {
    const filter = req.user.rol === 'admin'
      ? {}
      : { usuario_id: req.user._id }

    const reservas = await Reserva.find(filter)
      .populate('usuario_id', 'nombre apellido email')
      .populate('cancha_id', 'nombre tipo precio_por_hora')
      .sort({ fecha_creacion: -1 })

    return res.status(200).json(reservas)
  } catch (error) {
    console.error('Error en getReservas:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// GET /api/reservas/:id
export const getReservaById = async (req, res) => {
  try {
    const reserva = await Reserva.findById(req.params.id)
      .populate('usuario_id', 'nombre apellido email')
      .populate('cancha_id', 'nombre tipo precio_por_hora')

    if (!reserva) {
      return res.status(404).json({ message: 'Reserva no encontrada' })
    }

    // Usuario solo puede ver sus propias reservas
    // usuario_id puede venir en null si el usuario fue borrado
    if (req.user.rol !== 'admin' &&
        reserva.usuario_id?._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Acceso denegado' })
    }

    return res.status(200).json(reserva)
  } catch (error) {
    console.error('Error en getReservaById:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// POST /api/reservas
export const createReserva = async (req, res) => {
  try {
    const parsed = reservaSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Datos inválidos',
        errors: parsed.error.issues.map(e => e.message)
      })
    }

    const { cancha_id, fecha, hora_inicio, hora_fin } = parsed.data

    if (!mongoose.isValidObjectId(cancha_id)) {
      return res.status(400).json({ message: 'Cancha inválida' })
    }

    // No se permiten reservas en fechas pasadas (fecha local del servidor, no UTC)
    const ahora = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const hoy = `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())}`
    if (fecha < hoy) {
      return res.status(400).json({ message: 'No se puede reservar en una fecha pasada' })
    }
    const horaActual = `${pad(ahora.getHours())}:${pad(ahora.getMinutes())}`
    if (fecha === hoy && hora_inicio <= horaActual) {
      return res.status(400).json({ message: 'No se puede reservar en una hora que ya pasó' })
    }

    // Verificar que la cancha existe y está activa
    const cancha = await Cancha.findById(cancha_id)
    if (!cancha || !cancha.activa) {
      return res.status(404).json({ message: 'Cancha no encontrada o inactiva' })
    }

    // Verificar que no haya conflicto de horario
    const conflicto = await Reserva.findOne({
      cancha_id,
      fecha: new Date(fecha),
      estado: { $ne: 'cancelada' },
      $or: [
        { hora_inicio: { $lt: hora_fin }, hora_fin: { $gt: hora_inicio } }
      ]
    })

    if (conflicto) {
      return res.status(409).json({
        message: 'La cancha ya está reservada en ese horario'
      })
    }

    // Franjas apartadas por un torneo en esa cancha y día
    const bloqueo = (await bloqueosDeTorneos(cancha_id, new Date(fecha)))
      .find(b => b.hora_inicio < hora_fin && b.hora_fin > hora_inicio)
    if (bloqueo) {
      return res.status(409).json({
        message: `La cancha está apartada para el torneo "${bloqueo.torneo}" de ${bloqueo.hora_inicio} a ${bloqueo.hora_fin}`
      })
    }

    // Calcular duración
    const [inicioH, inicioM] = hora_inicio.split(':').map(Number)
    const [finH, finM] = hora_fin.split(':').map(Number)
    const duracion_horas = ((finH * 60 + finM) - (inicioH * 60 + inicioM)) / 60
    const precio = Math.round(cancha.precio_por_hora * duracion_horas)

    const newReserva = new Reserva({
      usuario_id: req.user._id,
      cancha_id,
      fecha: new Date(fecha),
      hora_inicio,
      hora_fin,
      precio,
      estado: 'confirmada'
    })

    await newReserva.save()

    const reservaPopulada = await Reserva.findById(newReserva._id)
      .populate('cancha_id', 'nombre tipo precio_por_hora')
      .populate('usuario_id', 'nombre apellido email')

    return res.status(201).json({
      message: 'Reserva creada exitosamente',
      reserva: reservaPopulada
    })
  } catch (error) {
    console.error('Error en createReserva:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// PUT /api/reservas/:id/cancelar
export const cancelarReserva = async (req, res) => {
  try {
    const reserva = await Reserva.findById(req.params.id)

    if (!reserva) {
      return res.status(404).json({ message: 'Reserva no encontrada' })
    }

    // Solo el dueño o admin puede cancelar
    if (req.user.rol !== 'admin' &&
        reserva.usuario_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Acceso denegado' })
    }

    if (reserva.estado === 'cancelada') {
      return res.status(400).json({ message: 'La reserva ya está cancelada' })
    }

    // Una reserva de un día que ya pasó solo la puede cancelar el admin
    // (la fecha se guarda como medianoche UTC del día reservado)
    const ahora = new Date()
    const hoyUTC = Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
    if (req.user.rol !== 'admin' && reserva.fecha.getTime() < hoyUTC) {
      return res.status(400).json({ message: 'No se puede cancelar una reserva que ya pasó' })
    }

    reserva.estado = 'cancelada'
    await reserva.save()

    return res.status(200).json({ message: 'Reserva cancelada exitosamente' })
  } catch (error) {
    console.error('Error en cancelarReserva:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// DELETE /api/reservas/:id — solo admin
export const deleteReserva = async (req, res) => {
  try {
    const reserva = await Reserva.findByIdAndDelete(req.params.id)

    if (!reserva) {
      return res.status(404).json({ message: 'Reserva no encontrada' })
    }

    return res.status(200).json({ message: 'Reserva eliminada exitosamente' })
  } catch (error) {
    console.error('Error en deleteReserva:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}