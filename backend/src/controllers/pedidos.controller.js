import Pedido from '../models/pedido.model.js'
import PedidoItem from '../models/pedidoItem.model.js'
import Producto from '../models/producto.model.js'
import mongoose from 'mongoose'
import { pedidoSchema } from '../schema/pedido.schema.js'

const PRECIO_ENVIO = 15000
const ENVIO_GRATIS_DESDE = 300000

// GET /api/pedidos
export const getPedidos = async (req, res) => {
  try {
    const filter = req.user.rol === 'admin'
      ? {}
      : { usuario_id: req.user._id }

    const pedidos = await Pedido.find(filter)
      .populate('usuario_id', 'nombre apellido email')
      .sort({ fecha_pedido: -1 })

    // Agregar items a cada pedido
    const pedidosConItems = await Promise.all(
      pedidos.map(async (pedido) => {
        const items = await PedidoItem.find({ pedido_id: pedido._id })
          .populate('producto_id', 'nombre categoria imagen_id')
        return { ...pedido.toObject(), items }
      })
    )

    return res.status(200).json(pedidosConItems)
  } catch (error) {
    console.error('Error en getPedidos:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// GET /api/pedidos/:id
export const getPedidoById = async (req, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id)
      .populate('usuario_id', 'nombre apellido email')

    if (!pedido) {
      return res.status(404).json({ message: 'Pedido no encontrado' })
    }

    // usuario_id puede venir en null si el usuario fue borrado
    if (req.user.rol !== 'admin' &&
        pedido.usuario_id?._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Acceso denegado' })
    }

    const items = await PedidoItem.find({ pedido_id: pedido._id })
      .populate('producto_id', 'nombre categoria precio imagen_id')

    return res.status(200).json({ ...pedido.toObject(), items })
  } catch (error) {
    console.error('Error en getPedidoById:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// POST /api/pedidos
export const createPedido = async (req, res) => {
  try {
    const parsed = pedidoSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Datos inválidos',
        errors: parsed.error.issues.map(e => e.message)
      })
    }

    const { items, ciudad, direccion_envio, telefono_envio } = parsed.data

    // Verificar productos y calcular subtotal
    let subtotal = 0
    const itemsValidados = []

    for (const item of items) {
      if (!mongoose.isValidObjectId(item.producto_id)) {
        return res.status(400).json({ message: `Producto ${item.producto_id} inválido` })
      }

      const producto = await Producto.findById(item.producto_id)

      if (!producto || !producto.activo) {
        return res.status(404).json({
          message: `Producto ${item.producto_id} no encontrado o inactivo`
        })
      }

      if (producto.stock < item.cantidad) {
        return res.status(409).json({
          message: `Stock insuficiente para ${producto.nombre}. Disponible: ${producto.stock}`
        })
      }

      subtotal += producto.precio * item.cantidad
      itemsValidados.push({
        producto,
        cantidad: item.cantidad,
        precio_unitario: producto.precio
      })
    }

    // El envío se calcula en el servidor, no se acepta del cliente
    const precio_envio = subtotal >= ENVIO_GRATIS_DESDE ? 0 : PRECIO_ENVIO
    const precio_total = subtotal + precio_envio

    // Descontar stock de forma atómica: solo si sigue habiendo existencias
    const descontados = []
    for (const { producto, cantidad } of itemsValidados) {
      const actualizado = await Producto.findOneAndUpdate(
        { _id: producto._id, stock: { $gte: cantidad } },
        { $inc: { stock: -cantidad } }
      )

      if (!actualizado) {
        // Revertir lo ya descontado
        await Promise.all(descontados.map(d =>
          Producto.findByIdAndUpdate(d.id, { $inc: { stock: d.cantidad } })
        ))
        return res.status(409).json({
          message: `Stock insuficiente para ${producto.nombre}`
        })
      }

      descontados.push({ id: producto._id, cantidad })
    }

    // Crear pedido
    const newPedido = new Pedido({
      usuario_id: req.user._id,
      subtotal,
      precio_envio,
      precio_total,
      estado: 'pendiente',
      ciudad,
      direccion_envio,
      telefono_envio
    })

    await newPedido.save()

    // Crear items
    const pedidoItems = await Promise.all(
      itemsValidados.map(({ producto, cantidad, precio_unitario }) => {
        return PedidoItem.create({
          pedido_id: newPedido._id,
          producto_id: producto._id,
          nombre: producto.nombre,
          precio_unitario,
          cantidad
        })
      })
    )

    return res.status(201).json({
      message: 'Pedido creado exitosamente',
      pedido: { ...newPedido.toObject(), items: pedidoItems }
    })
  } catch (error) {
    console.error('Error en createPedido:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// PUT /api/pedidos/:id/estado — solo admin
export const updateEstadoPedido = async (req, res) => {
  try {
    const { estado } = req.body
    // 'cancelado' se gestiona en PUT /:id/cancelar, que además devuelve el stock
    const estadosValidos = ['pendiente', 'pagado', 'enviado']

    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ message: 'Estado inválido. Para cancelar usa la opción de cancelar pedido.' })
    }

    const pedido = await Pedido.findById(req.params.id)

    if (!pedido) {
      return res.status(404).json({ message: 'Pedido no encontrado' })
    }

    if (pedido.estado === 'cancelado') {
      return res.status(400).json({ message: 'Un pedido cancelado no se puede modificar' })
    }

    pedido.estado = estado
    await pedido.save()

    return res.status(200).json({
      message: 'Estado actualizado exitosamente',
      pedido
    })
  } catch (error) {
    console.error('Error en updateEstadoPedido:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// PUT /api/pedidos/:id/cancelar
export const cancelarPedido = async (req, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id)

    if (!pedido) {
      return res.status(404).json({ message: 'Pedido no encontrado' })
    }

    if (req.user.rol !== 'admin' &&
        pedido.usuario_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Acceso denegado' })
    }

    if (pedido.estado === 'cancelado') {
      return res.status(400).json({ message: 'El pedido ya está cancelado' })
    }

    if (pedido.estado === 'enviado') {
      return res.status(400).json({ message: 'No se puede cancelar un pedido ya enviado' })
    }

    // Restaurar stock
    const items = await PedidoItem.find({ pedido_id: pedido._id })
    await Promise.all(
      items.map(item =>
        Producto.findByIdAndUpdate(item.producto_id, {
          $inc: { stock: item.cantidad }
        })
      )
    )

    pedido.estado = 'cancelado'
    await pedido.save()

    return res.status(200).json({ message: 'Pedido cancelado exitosamente' })
  } catch (error) {
    console.error('Error en cancelarPedido:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}