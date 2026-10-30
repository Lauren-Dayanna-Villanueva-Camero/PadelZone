import Producto from '../models/producto.model.js'
import { productoSchema, productoUpdateSchema } from '../schema/producto.schema.js'
import { isAdminRequest } from '../middlewares/auth.middleware.js'

// GET /api/productos — ?todas=1 incluye los inactivos (solo admin)
export const getProductos = async (req, res) => {
  try {
    const { categoria } = req.query

    const filter = req.query.todas === '1' && isAdminRequest(req) ? {} : { activo: true }
    if (categoria) filter.categoria = categoria

    const productos = await Producto.find(filter)
      .populate('imagen_id', 'url nombre_archivo')
      .populate('creado_por', 'nombre apellido')
      .sort({ createdAt: -1 })

    return res.status(200).json(productos)
  } catch (error) {
    console.error('Error en getProductos:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// GET /api/productos/:id
export const getProductoById = async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id)
      .populate('imagen_id', 'url nombre_archivo')

    if (!producto || !producto.activo) {
      return res.status(404).json({ message: 'Producto no encontrado' })
    }

    return res.status(200).json(producto)
  } catch (error) {
    console.error('Error en getProductoById:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// POST /api/productos — solo admin
export const createProducto = async (req, res) => {
  try {
    const parsed = productoSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Datos inválidos',
        errors: parsed.error.issues.map(e => e.message)
      })
    }

    const newProducto = new Producto({
      ...parsed.data,
      creado_por: req.user._id
    })

    await newProducto.save()

    return res.status(201).json({
      message: 'Producto creado exitosamente',
      producto: newProducto
    })
  } catch (error) {
    console.error('Error en createProducto:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// PUT /api/productos/:id — solo admin
export const updateProducto = async (req, res) => {
  try {
    const parsed = productoUpdateSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Datos inválidos',
        errors: parsed.error.issues.map(e => e.message)
      })
    }

    const producto = await Producto.findByIdAndUpdate(
      req.params.id,
      parsed.data,
      { new: true, runValidators: true }
    ).populate('imagen_id', 'url nombre_archivo')

    if (!producto) {
      return res.status(404).json({ message: 'Producto no encontrado' })
    }

    return res.status(200).json({
      message: 'Producto actualizado exitosamente',
      producto
    })
  } catch (error) {
    console.error('Error en updateProducto:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// DELETE /api/productos/:id — solo admin
export const deleteProducto = async (req, res) => {
  try {
    const producto = await Producto.findByIdAndUpdate(
      req.params.id,
      { activo: false },
      { new: true }
    )

    if (!producto) {
      return res.status(404).json({ message: 'Producto no encontrado' })
    }

    return res.status(200).json({ message: 'Producto desactivado exitosamente' })
  } catch (error) {
    console.error('Error en deleteProducto:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}