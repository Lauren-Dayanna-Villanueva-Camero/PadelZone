import mongoose from 'mongoose'

const pedidoSchema = new mongoose.Schema({
  usuario_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  subtotal: {
    type: Number,
    required: true,
    min: 0
  },

  precio_envio: {
    type: Number,
    default: 0,
    min: 0
  },

  precio_total: {
    type: Number,
    required: true,
    min: 0
  },

  estado: {
    type: String,
    enum: ['pendiente', 'pagado', 'enviado', 'cancelado'],
    default: 'pendiente'
  },

  ciudad: {
    type: String,
    trim: true
  },

  direccion_envio: {
    type: String,
    trim: true
  },

  telefono_envio: {
    type: String,
    trim: true
  },

  operador_logistico: {
    type: String,
    trim: true
  },

  numero_guia: {
    type: String,
    trim: true
  }
}, {
  timestamps: {
    createdAt: 'fecha_pedido',
    updatedAt: false
  }
})

export default mongoose.model('Pedido', pedidoSchema)