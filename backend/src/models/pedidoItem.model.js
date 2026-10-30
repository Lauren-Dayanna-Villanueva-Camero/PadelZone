import mongoose from 'mongoose'

const pedidoItemSchema = new mongoose.Schema({
  pedido_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pedido',
    required: true
  },

  producto_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Producto',
    required: true
  },

  nombre: {
    type: String,
    required: true,
    trim: true
  },

  precio_unitario: {
    type: Number,
    required: true,
    min: 0
  },

  cantidad: {
    type: Number,
    required: true,
    min: 1
  }
})

export default mongoose.model('PedidoItem', pedidoItemSchema)