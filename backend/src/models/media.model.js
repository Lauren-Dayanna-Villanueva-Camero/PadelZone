import mongoose from 'mongoose'

const mediaSchema = new mongoose.Schema({
  // Cloudinary: URL absoluta. Local: '/api/media/<id>/archivo'.
  // Registros antiguos pueden tener aún una data URL en base64.
  url: {
    type: String,
    required: true,
    trim: true
  },

  nombre_archivo: {
    type: String,
    required: true,
    trim: true
  },

  tipo: {
    type: String,
    enum: ['carrusel', 'cancha', 'producto', 'clase'],
    required: true
  },

  mime_type: {
    type: String
  },

  tamano: {
    type: Number
  },

  // Solo si se subió a Cloudinary (necesario para borrarla allí)
  public_id: {
    type: String
  },

  // Solo almacenamiento local. select:false para que los listados no carguen el binario
  data: {
    type: Buffer,
    select: false
  },

  subida_por: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: {
    createdAt: 'uploaded_at',
    updatedAt: false
  }
})

export default mongoose.model('Media', mediaSchema)
