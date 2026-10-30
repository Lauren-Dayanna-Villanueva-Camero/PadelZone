import mongoose from 'mongoose'

const torneoSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },

  tipo_torneo: {
    type: String,
    enum: ['Amateur', 'Profesional', 'Comunidad'],
    required: true
  },

  fecha_inicio: {
    type: Date,
    required: true
  },

  fecha_fin: {
    type: Date,
    required: true
  },

  cupo_maximo_parejas: {
    type: Number,
    required: true,
    min: 1
  },

  precio_inscripcion: {
    type: Number,
    required: true,
    min: 0
  },

  estado: {
    type: String,
    enum: ['activo', 'en_curso', 'finalizado', 'cancelado'],
    default: 'activo'
  }
}, {
  timestamps: true
})

export default mongoose.model('Torneo', torneoSchema)