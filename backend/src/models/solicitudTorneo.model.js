import mongoose from 'mongoose'

// Solicitud de una empresa u organizador para hacer un torneo en PadelZone.
// Modalidades:
// - 'bloque': alquila las canchas elegidas solo en los días y la franja del torneo
// - 'convenio': igual que el bloque, pero firma un convenio por varios meses con
//   descuento en este torneo y en los que pida mientras esté vigente
// El admin la aprueba (se crea el torneo y las canchas quedan bloqueadas) o la rechaza.
const solicitudTorneoSchema = new mongoose.Schema({
  solicitante_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  empresa: {
    nombre: { type: String, required: true, trim: true },
    nit: { type: String, trim: true, default: '' },
    contacto: { type: String, required: true, trim: true },
    telefono: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true }
  },

  nombre_torneo: {
    type: String,
    required: true,
    trim: true
  },

  tipo_torneo: {
    type: String,
    enum: ['Amateur', 'Profesional', 'Comunidad'],
    required: true
  },

  descripcion: {
    type: String,
    trim: true,
    default: ''
  },

  modalidad: {
    type: String,
    enum: ['bloque', 'convenio'],
    required: true
  },

  // Solo en un convenio nuevo
  convenio_meses: {
    type: Number,
    enum: [3, 6, 12, null],
    default: null
  },

  // Convenio vigente que se usó para el descuento (si la empresa ya tenía uno)
  convenio_origen_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SolicitudTorneo',
    default: null
  },

  // Al aprobar un convenio nuevo: hasta cuándo aplica el descuento
  convenio_vigente_hasta: {
    type: Date,
    default: null
  },

  fecha_inicio: { type: Date, required: true },
  fecha_fin: { type: Date, required: true },
  hora_inicio: { type: String, required: true },
  hora_fin: { type: String, required: true },

  duracion_partido_min: {
    type: Number,
    default: 90,
    min: 30
  },

  canchas: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cancha',
    required: true
  }],

  cupo_maximo_parejas: {
    type: Number,
    required: true,
    min: 2
  },

  // Lo que paga cada jugador al inscribirse (0 = la empresa asume la inscripción)
  precio_inscripcion: {
    type: Number,
    default: 0,
    min: 0
  },

  inscripcion_apertura: { type: Date, required: true },
  inscripcion_cierre: { type: Date, required: true },

  // Cotización calculada en el servidor al crear la solicitud
  costo: {
    dias: Number,
    horas_por_dia: Number,
    horas_cancha: Number,
    valor_hora: Number,
    subtotal: Number,
    descuento_pct: Number,
    descuento: Number,
    total: Number
  },

  estado: {
    type: String,
    enum: ['pendiente', 'aprobada', 'rechazada', 'cancelada'],
    default: 'pendiente'
  },

  respuesta_admin: {
    type: String,
    trim: true,
    default: ''
  },

  torneo_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Torneo',
    default: null
  }
}, {
  timestamps: true
})

export default mongoose.model('SolicitudTorneo', solicitudTorneoSchema)
