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
  },

  // Periodo de inscripciones (días completos, guardados como medianoche UTC igual
  // que fecha_inicio). Antes de la apertura el torneo sale como "Próximamente" y al
  // pasar el cierre se cierran solas. Sin fechas (torneos antiguos) las abre y
  // cierra el admin a mano.
  inscripcion_apertura: {
    type: Date,
    default: null
  },

  inscripcion_cierre: {
    type: Date,
    default: null
  },

  // Franja diaria en la que se juegan los partidos (HH:mm)
  hora_inicio: {
    type: String,
    default: '08:00'
  },

  hora_fin: {
    type: String,
    default: '20:00'
  },

  duracion_partido_min: {
    type: Number,
    default: 90,
    min: 30
  },

  // Canchas apartadas para el torneo: quedan bloqueadas para reservas en sus
  // días y franja. Vacío = se programan los partidos en todas las canchas activas
  // sin bloquear reservas (torneos antiguos)
  canchas: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cancha'
  }],

  // Torneo pedido por una empresa u organizador externo
  organizador: {
    type: String,
    trim: true,
    default: ''
  },

  solicitud_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SolicitudTorneo',
    default: null
  }
}, {
  timestamps: true
})

export default mongoose.model('Torneo', torneoSchema)