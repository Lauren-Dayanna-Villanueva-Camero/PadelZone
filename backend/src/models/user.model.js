import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },

  apellido: {
    type: String,
    required: true,
    trim: true
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },

  password_hash: {
    type: String,
    required: true
  },

  telefono: {
    type: String,
    trim: true
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