import mongoose from 'mongoose'

const participanteSchema = new mongoose.Schema({
  torneo_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Torneo',
    required: true
  },

  usuario_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  pareja_usuario_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  pago_confirmado: {
    type: Boolean,
    default: false
  },

  // Número de pareja asignado al cerrar inscripciones: dos participantes con el
  // mismo número forman una pareja. null = aún sin organizar o sin pareja asignada
  equipo: {
    type: Number,
    default: null
  }
}, {
  timestamps: {
    createdAt: 'fecha_inscripcion',
    updatedAt: false
  }
})

export default mongoose.model('Participante', participanteSchema)