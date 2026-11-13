import mongoose from 'mongoose'

const reservaSchema = new mongoose.Schema({
  usuario_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  cancha_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cancha',
    required: true
  },

  fecha: {
    type: Date,
    required: true
  },

  hora_inicio: {
    type: String,
    required: true
  },

  hora_fin: {
    type: String,
    required: true
  },

  precio: {
    type: Number,
    required: true,
    min: 0
  },

  // pendiente = horario apartado mientras se paga en línea; si no se paga antes
  // de `expira_en` se cancela sola. Pagar en la sede la deja confirmada sin pagar
  estado: {
    type: String,
    enum: ['pendiente', 'confirmada', 'cancelada'],
    default: 'confirmada'
  },

  expira_en: {
    type: Date,
    default: null
  },

  pagada: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: {
    createdAt: 'fecha_creacion',
    updatedAt: false
  }
})

export default mongoose.model('Reserva', reservaSchema)