import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },

  // Google no siempre entrega el apellido: en esas cuentas es opcional
  apellido: {
    type: String,
    required: function () { return !this.google_id },
    trim: true,
    default: ''
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },

  // Las cuentas creadas con Google no tienen contraseña hasta que el usuario
  // elija una con "¿Olvidaste tu contraseña?"
  password_hash: {
    type: String,
    required: function () { return !this.google_id }
  },

  // Identificador de la cuenta de Google vinculada (campo `sub` del ID token).
  // No lleva select: false porque las validaciones de arriba lo necesitan al guardar
  google_id: {
    type: String,
    unique: true,
    sparse: true
  },

  telefono: {
    type: String,
    trim: true
  },

  // Foto de perfil: documento Media (tipo 'avatar') y su URL, para no tener que
  // poblarla en cada listado
  foto_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Media',
    default: null
  },

  foto_url: {
    type: String,
    default: null
  },

  rol: {
    type: String,
    enum: ['usuario', 'admin', 'profesor'],
    default: 'usuario'
  },

  activo: {
    type: Boolean,
    default: true
  },

  // Recuperación de contraseña: solo se guarda el hash del token
  reset_token_hash: {
    type: String,
    select: false
  },

  reset_token_expira: {
    type: Date,
    select: false
  }
}, {
  timestamps: {
    createdAt: 'fecha_registro',
    updatedAt: 'updated_at'
  }
})

export default mongoose.model('User', userSchema)