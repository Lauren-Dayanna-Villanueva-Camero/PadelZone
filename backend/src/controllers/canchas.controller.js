import Cancha from '../models/cancha.model.js'
import { canchaSchema, canchaUpdateSchema } from '../schema/cancha.schema.js'
import { isAdminRequest } from '../middlewares/auth.middleware.js'

// GET /api/canchas — ?todas=1 incluye las inactivas (solo admin)
export const getCanchas = async (req, res) => {
  try {
    const filter = req.query.todas === '1' && isAdminRequest(req) ? {} : { activa: true }
    const canchas = await Cancha.find(filter)
      .populate('imagen_id', 'url nombre_archivo')
      .populate('creada_por', 'nombre apellido')
      .sort({ createdAt: -1 })

    return res.status(200).json(canchas)
  } catch (error) {
    console.error('Error en getCanchas:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// GET /api/canchas/:id
export const getCanchaById = async (req, res) => {
  try {
    const cancha = await Cancha.findById(req.params.id)
      .populate('imagen_id', 'url nombre_archivo')
      .populate('creada_por', 'nombre apellido')

    if (!cancha) {
      return res.status(404).json({ message: 'Cancha no encontrada' })
    }

    return res.status(200).json(cancha)
  } catch (error) {
    console.error('Error en getCanchaById:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// POST /api/canchas
export const createCancha = async (req, res) => {
  try {
    const parsed = canchaSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Datos inválidos',
        errors: parsed.error.issues.map(e => e.message)
      })
    }

    const newCancha = new Cancha({
      ...parsed.data,
      creada_por: req.user._id
    })

    await newCancha.save()

    return res.status(201).json({
      message: 'Cancha creada exitosamente',
      cancha: newCancha
    })
  } catch (error) {
    console.error('Error en createCancha:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// PUT /api/canchas/:id
export const updateCancha = async (req, res) => {
  try {
    const parsed = canchaUpdateSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Datos inválidos',
        errors: parsed.error.issues.map(e => e.message)
      })
    }

    const cancha = await Cancha.findByIdAndUpdate(
      req.params.id,
      parsed.data,
      { new: true, runValidators: true }
    ).populate('imagen_id', 'url nombre_archivo')

    if (!cancha) {
      return res.status(404).json({ message: 'Cancha no encontrada' })
    }

    return res.status(200).json({
      message: 'Cancha actualizada exitosamente',
      cancha
    })
  } catch (error) {
    console.error('Error en updateCancha:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// DELETE /api/canchas/:id
export const deleteCancha = async (req, res) => {
  try {
    const cancha = await Cancha.findByIdAndUpdate(
      req.params.id,
      { activa: false },
      { new: true }
    )

    if (!cancha) {
      return res.status(404).json({ message: 'Cancha no encontrada' })
    }

    return res.status(200).json({ message: 'Cancha desactivada exitosamente' })
  } catch (error) {
    console.error('Error en deleteCancha:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}