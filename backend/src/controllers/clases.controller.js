import InscripcionClase from '../models/inscripcionClase.model.js'
import { inscripcionClaseSchema } from '../schema/clase.schema.js'

// GET /api/clases/mis-inscripciones
export const getMisInscripciones = async (req, res) => {
  try {
    const inscripciones = await InscripcionClase.find({
      usuario_id: req.user._id,
      estado: 'confirmada'
    }).sort({ fecha_inscripcion: -1 })

    return res.status(200).json(inscripciones)
  } catch (error) {
    console.error('Error en getMisInscripciones (clases):', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// GET /api/clases/inscripciones — solo admin
export const getInscripciones = async (req, res) => {
  try {
    const inscripciones = await InscripcionClase.find()
      .populate('usuario_id', 'nombre apellido email')
      .sort({ fecha_inscripcion: -1 })

    return res.status(200).json(inscripciones)
  } catch (error) {
    console.error('Error en getInscripciones (clases):', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// POST /api/clases/inscripciones
export const createInscripcion = async (req, res) => {
  try {
    const parsed = inscripcionClaseSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Datos inválidos',
        errors: parsed.error.issues.map(e => e.message)
      })
    }

    const { clase_id, grupo, fecha_nacimiento } = parsed.data

    if (new Date(fecha_nacimiento) >= new Date()) {
      return res.status(400).json({ message: 'La fecha de nacimiento no es válida' })
    }

    const existente = await InscripcionClase.findOne({
      usuario_id: req.user._id,
      clase_id,
      grupo,
      estado: 'confirmada'
    })
    if (existente) {
      return res.status(409).json({ message: 'Ya estás inscrito en esta clase y grupo' })
    }

    const inscripcion = await InscripcionClase.create({
      ...parsed.data,
      fecha_nacimiento: new Date(fecha_nacimiento),
      usuario_id: req.user._id
    })

    return res.status(201).json({ message: 'Inscripción exitosa', inscripcion })
  } catch (error) {
    console.error('Error en createInscripcion (clases):', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// PUT /api/clases/inscripciones/:id/cancelar — dueño o admin
export const cancelarInscripcion = async (req, res) => {
  try {
    const inscripcion = await InscripcionClase.findById(req.params.id)

    if (!inscripcion) {
      return res.status(404).json({ message: 'Inscripción no encontrada' })
    }

    if (req.user.rol !== 'admin' &&
        inscripcion.usuario_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Acceso denegado' })
    }

    if (inscripcion.estado === 'cancelada') {
      return res.status(400).json({ message: 'La inscripción ya está cancelada' })
    }

    inscripcion.estado = 'cancelada'
    await inscripcion.save()

    return res.status(200).json({ message: 'Inscripción cancelada' })
  } catch (error) {
    console.error('Error en cancelarInscripcion (clases):', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}
