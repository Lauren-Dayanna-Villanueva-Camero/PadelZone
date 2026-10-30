import Carrusel from '../models/carrusel.model.js'
import { carruselSchema, carruselUpdateSchema } from '../schema/carrusel.schema.js'
import { isAdminRequest } from '../middlewares/auth.middleware.js'

// GET /api/carrusel — público; ?todas=1 incluye los inactivos (solo admin)
export const getCarrusel = async (req, res) => {
  try {
    const filter = req.query.todas === '1' && isAdminRequest(req) ? {} : { activo: true }
    const slides = await Carrusel.find(filter)
      .populate('imagen_id', 'url nombre_archivo')
      .populate('editado_por', 'nombre apellido')
      .sort({ orden: 1 })

    return res.status(200).json(slides)
  } catch (error) {
    console.error('Error en getCarrusel:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// POST /api/carrusel — solo admin
export const createSlide = async (req, res) => {
  try {
    const parsed = carruselSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Datos inválidos',
        errors: parsed.error.issues.map(e => e.message)
      })
    }

    const newSlide = new Carrusel({
      ...parsed.data,
      editado_por: req.user._id
    })

    await newSlide.save()

    return res.status(201).json({
      message: 'Slide creado exitosamente',
      slide: newSlide
    })
  } catch (error) {
    console.error('Error en createSlide:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// PUT /api/carrusel/:id — solo admin
export const updateSlide = async (req, res) => {
  try {
    const parsed = carruselUpdateSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Datos inválidos',
        errors: parsed.error.issues.map(e => e.message)
      })
    }

    const slide = await Carrusel.findByIdAndUpdate(
      req.params.id,
      { ...parsed.data, editado_por: req.user._id },
      { new: true, runValidators: true }
    ).populate('imagen_id', 'url nombre_archivo')

    if (!slide) {
      return res.status(404).json({ message: 'Slide no encontrado' })
    }

    return res.status(200).json({
      message: 'Slide actualizado exitosamente',
      slide
    })
  } catch (error) {
    console.error('Error en updateSlide:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// DELETE /api/carrusel/:id — solo admin
export const deleteSlide = async (req, res) => {
  try {
    const slide = await Carrusel.findByIdAndUpdate(
      req.params.id,
      { activo: false, editado_por: req.user._id },
      { new: true }
    )

    if (!slide) {
      return res.status(404).json({ message: 'Slide no encontrado' })
    }

    return res.status(200).json({ message: 'Slide desactivado exitosamente' })
  } catch (error) {
    console.error('Error en deleteSlide:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}