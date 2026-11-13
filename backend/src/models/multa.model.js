import mongoose from 'mongoose'

// Multa por no asistir a una reserva que se iba a pagar en la sede (la cancha
// quedó apartada y nadie la usó). La registra el admin desde Reservas; mientras
// esté pendiente el usuario no puede hacer reservas nuevas. Se paga como
// cualquier otro cobro (Pago con concepto 'multa').
const multaSchema = new mongoose.Schema({
  usuario_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Una multa por reserva
  reserva_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reserva',
    required: true,
    unique: true
  },

  // Pesos colombianos: un porcentaje del precio de la reserva (MULTA_PORCENTAJE)
  monto: {
    type: Number,
    required: true,
    min: 0
  },

  descripcion: {
    type: String,
    trim: true,
    default: ''
  },

  // anulada = el admin la perdonó (o deshizo la inasistencia)
  estado: {
    type: String,
    enum: ['pendiente', 'pagada', 'anulada'],
    default: 'pendiente'
  },

  // Por qué se anuló
  motivo_anulacion: {
    type: String,
    trim: true,
    default: ''
  },

  pagada_en: {
    type: Date,
    default: null
  },

  registrada_por: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
})

multaSchema.index({ usuario_id: 1, estado: 1 })

export default mongoose.model('Multa', multaSchema)
