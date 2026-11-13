import mongoose from 'mongoose'
import Media from '../models/media.model.js'
import { cloudinaryEnabled, uploadBuffer, destroyImage, MAX_SIZE_MONGO } from './cloudinary.js'

const errorImagen = (status, message) => Object.assign(new Error(message), { status })

// El mimetype lo declara el cliente; se comprueba la firma real del archivo
export const detectImageType = (buf) => {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
}

// Guarda una imagen subida con multer (req.file) en Cloudinary o, si no está
// disponible, en MongoDB. Devuelve el documento Media creado.
// `maxBytes` limita el tamaño (además del tope de MongoDB)
export const guardarImagen = async (file, { tipo, usuarioId, maxBytes = Infinity }) => {
  if (!file) throw errorImagen(400, 'No se proporcionó ninguna imagen')

  const mimeType = detectImageType(file.buffer)
  if (!mimeType) throw errorImagen(400, 'El archivo no es una imagen JPG, PNG o WEBP válida')
  if (file.size > maxBytes) {
    throw errorImagen(400, `La imagen supera el tamaño máximo de ${Math.round(maxBytes / 1024 / 1024)}MB`)
  }

  const _id = new mongoose.Types.ObjectId()
  const media = {
    _id,
    nombre_archivo: file.originalname || `${tipo}.${mimeType.split('/')[1]}`,
    tipo,
    mime_type: mimeType,
    tamano: file.size,
    subida_por: usuarioId
  }

  if (cloudinaryEnabled()) {
    try {
      const result = await uploadBuffer(file.buffer, tipo)
      media.url = result.secure_url
      media.public_id = result.public_id
    } catch (error) {
      // Si Cloudinary falla, se intenta guardar en MongoDB
      console.error('Error subiendo a Cloudinary, se usará MongoDB:', error.message)
    }
  }

  if (!media.url) {
    if (file.size > MAX_SIZE_MONGO) {
      throw errorImagen(400, `La imagen supera el tamaño máximo de ${MAX_SIZE_MONGO / 1024 / 1024}MB`)
    }
    // Se sirve desde GET /api/media/:id/archivo
    media.url = `/api/media/${_id}/archivo`
    media.data = file.buffer
  }

  return Media.create(media)
}

// Borra la imagen de MongoDB y, si estaba allí, de Cloudinary
export const borrarImagen = async (id) => {
  const media = await Media.findByIdAndDelete(id)
  if (media?.public_id && cloudinaryEnabled()) {
    await destroyImage(media.public_id).catch(err => console.error('No se pudo borrar de Cloudinary:', err))
  }
  return media
}
