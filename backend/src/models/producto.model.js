import mongoose from 'mongoose'

const productoSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },

  descripcion: {
    type: String,
    trim: true
  },

  categoria: {
    type: String,
    enum: ['pala', 'ropa', 'accesorios', 'calzado'],
    required: true
  },

  precio: {
    type: Number,
    required: true,
    min: 0
  },

  stock: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },

  imagen_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Media'
  },

  activo: {
    type: Boolean,
    default: true
  },

  creado_por: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
})

export default mongoose.model('Producto', productoSchema)