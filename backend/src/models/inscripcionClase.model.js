import mongoose from 'mongoose'

// El catálogo de clases vive en el frontend (pages/clases); aquí se guarda una copia
// de los datos de la clase elegida para que la inscripción no cambie si el catálogo cambia
const inscripcionClaseSchema = new mongoose.Schema({
  usuario_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  clase_id: { type: Number, required: true },
  clase_nombre: { type: String, required: true, trim: true },
  tipo_clase: { type: String, trim: true },
  color: { type: String, trim: true },
  grupo: { type: String, required: true, trim: true },
  profesor: { type: String, trim: true },
  dias: { type: String, trim: true },
  horario: { type: String, required: true, trim: true },
  precio: { type: String, trim: true },
  // Valor mensual en pesos, tomado de la tabla del servidor (libs/clases.js)
  monto: { type: Number, min: 0, default: 0 },
  pago_confirmado: { type: Boolean, default: false },

  nivel: {
    type: String,
    enum: ['principiante', 'intermedio', 'avanzado'],
    required: true
  },
  nombre_alumno: { type: String, required: true, trim: true },
  telefono: { type: String, required: true, trim: true },
  fecha_nacimiento: { type: Date, required: true },

  estado: {
    type: String,
    enum: ['confirmada', 'cancelada'],
    default: 'confirmada'
  }
}, {
  timestamps: {
    createdAt: 'fecha_inscripcion',
    updatedAt: false
  }
})

export default mongoose.model('InscripcionClase', inscripcionClaseSchema)
