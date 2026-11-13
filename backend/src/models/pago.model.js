import mongoose from 'mongoose'

// Un intento de pago de algo que se cobra en PadelZone. Lo que se paga se
// identifica con `concepto` + `referencia_id`:
// - reserva → Reserva
// - pedido  → Pedido
// - torneo  → Participante (la inscripción del jugador)
// - clase   → InscripcionClase
// El monto siempre lo calcula el servidor (libs/pagos.js → obtenerCargo).
const pagoSchema = new mongoose.Schema({
  usuario_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  concepto: {
    type: String,
    enum: ['reserva', 'pedido', 'torneo', 'clase'],
    required: true
  },

  referencia_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },

  // Referencia única que se envía a la pasarela y sale en el comprobante
  referencia: {
    type: String,
    required: true,
    unique: true
  },

  descripcion: {
    type: String,
    trim: true,
    default: ''
  },

  // Pesos colombianos, sin decimales
  monto: {
    type: Number,
    required: true,
    min: 0
  },

  // efectivo = se paga en la sede (o contraentrega) y lo confirma el admin
  metodo: {
    type: String,
    enum: ['tarjeta', 'pse', 'nequi', 'efectivo', 'otro'],
    required: true
  },

  // wompi = pasarela real; simulado = sin llaves de Wompi (desarrollo / demo);
  // manual = efectivo o registrado por el admin
  proveedor: {
    type: String,
    enum: ['wompi', 'simulado', 'manual'],
    required: true
  },

  estado: {
    type: String,
    enum: ['pendiente', 'aprobado', 'rechazado', 'anulado'],
    default: 'pendiente'
  },

  // Id de la transacción en la pasarela
  transaccion_id: {
    type: String,
    default: null
  },

  // Datos no sensibles para el comprobante (nunca el número completo de la tarjeta)
  detalle: {
    marca: String,
    ultimos4: String,
    banco: String,
    telefono: String
  },

  // Motivo de un rechazo o de una anulación
  mensaje: {
    type: String,
    trim: true,
    default: ''
  },

  pagado_en: {
    type: Date,
    default: null
  },

  // Admin que confirmó o anuló el pago a mano
  registrado_por: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
})

pagoSchema.index({ concepto: 1, referencia_id: 1 })
pagoSchema.index({ usuario_id: 1, createdAt: -1 })

export default mongoose.model('Pago', pagoSchema)
