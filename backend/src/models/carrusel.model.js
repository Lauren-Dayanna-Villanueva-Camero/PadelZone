import mongoose from 'mongoose'

const carruselSchema = new mongoose.Schema({
  imagen_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Media',
    required: true
  },

  titulo: {
    type: String,
    required: true,
    trim: true
  },

  subtitulo: {
    type: String,
    trim: true
  },

  orden: {
    type: Number,
    default: 0,
    min: 0
  },

  activo: {
    type: Boolean,
    default: true
  },

  editado_por: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: {
    createdAt: false,
    updatedAt: 'updated_at'
  }
})

export default mongoose.model('Carrusel', carruselSchema)