import mongoose from 'mongoose'

// Un partido del cuadro de eliminación. Los equipos se guardan con el número
// de pareja (Participante.equipo). En la ronda 1, un equipo null es un BYE;
// en las demás rondas null significa que aún no se conoce (por definir).
const partidoSchema = new mongoose.Schema({
  torneo_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Torneo',
    required: true
  },

  // 1 = primera ronda; la última ronda es la final
  ronda: {
    type: Number,
    required: true,
    min: 1
  },

  // Orden dentro de la ronda (desde 0). El ganador de la posición p pasa a la
  // posición p/2 de la ronda siguiente
  posicion: {
    type: Number,
    required: true,
    min: 0
  },

  equipo_a: {
    type: Number,
    default: null
  },

  equipo_b: {
    type: Number,
    default: null
  },

  ganador: {
    type: Number,
    default: null
  },

  // Horario: se programa solo al armar el cuadro y el admin lo puede ajustar.
  // null = por definir (por ejemplo, si no alcanzan los turnos del torneo)
  fecha: {
    type: Date,
    default: null
  },

  hora_inicio: {
    type: String,
    default: null
  },

  hora_fin: {
    type: String,
    default: null
  },

  cancha_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cancha',
    default: null
  }
}, {
  timestamps: true
})

partidoSchema.index({ torneo_id: 1, ronda: 1, posicion: 1 }, { unique: true })

export default mongoose.model('Partido', partidoSchema)
