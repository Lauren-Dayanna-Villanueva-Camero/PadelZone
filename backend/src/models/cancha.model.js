import mongoose from 'mongoose'

const canchaSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },

  tipo: {
    type: String,
    enum: ['Interior', 'Exterior'],
    required: true
  },

  techada: {
    type: Boolean,
    default: false
  },

  precio_por_hora: {
    type: Number,
    required: true,
    min: 0
  },

  imagen_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Media'
  },

  caracteristicas: {
    type: [String],
    default: []
  },

  activa: {
    type: Boolean,
    default: true
  },

  creada_por: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
})

export default mongoose.model('Cancha', canchaSchema)