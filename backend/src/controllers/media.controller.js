import mongoose from 'mongoose'
import Media from '../models/media.model.js'
import Cancha from '../models/cancha.model.js'
import Producto from '../models/producto.model.js'
import Carrusel from '../models/carrusel.model.js'
import { cloudinaryEnabled, uploadBuffer, destroyImage, MAX_SIZE_MONGO } from '../libs/cloudinary.js'

const tiposValidos = ['carrusel', 'cancha', 'producto', 'clase']

// El mimetype lo declara el cliente; se comprueba la firma real del archivo
const detectImageType = (buf) => {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
}

// POST /api/media/upload — solo admin
export const uploadMedia = async (req, res) => {
  try {
    const { tipo } = req.body

    if (!req.file) {
      return res.status(400).json({ message: 'No se proporcionó ninguna imagen' })
    }

    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({ message: 'Tipo de imagen inválido' })
    }

    const mimeType = detectImageType(req.file.buffer)
    if (!mimeType) {
      return res.status(400).json({ message: 'El archivo no es una imagen JPG, PNG o WEBP válida' })
    }

    const _id = new mongoose.Types.ObjectId()
    const media = {
      _id,
      nombre_archivo: req.file.originalname,
      tipo,
      mime_type: mimeType,
      tamano: req.file.size,
      subida_por: req.user._id
    }

    if (cloudinaryEnabled()) {
      try {
        const result = await uploadBuffer(req.file.buffer, tipo)
        media.url = result.secure_url
        media.public_id = result.public_id
      } catch (error) {
        // Si Cloudinary falla, se intenta guardar en MongoDB
        console.error('Error subiendo a Cloudinary, se usará MongoDB:', error.message)
      }
    }

    if (!media.url) {
      if (req.file.size > MAX_SIZE_MONGO) {
        return res.status(400).json({
          message: `La imagen supera el tamaño máximo de ${MAX_SIZE_MONGO / 1024 / 1024}MB`
        })
      }
      // Se sirve desde GET /api/media/:id/archivo
      media.url = `/api/media/${_id}/archivo`
      media.data = req.file.buffer
    }

    const newMedia = await Media.create(media)

    return res.status(201).json({
      message: 'Imagen subida exitosamente',
      media: {
        _id: newMedia._id,
        url: newMedia.url,
        nombre_archivo: newMedia.nombre_archivo,
        tipo: newMedia.tipo,
        tamano: newMedia.tamano,
        uploaded_at: newMedia.uploaded_at
      }
    })
  } catch (error) {
    console.error('Error en uploadMedia:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// GET /api/media — solo admin (las páginas públicas reciben las imágenes ya pobladas)
export const getMedia = async (req, res) => {
  try {
    const { tipo } = req.query
    const filter = tiposValidos.includes(tipo) ? { tipo } : {}

    const media = await Media.find(filter)
      .populate('subida_por', 'nombre apellido')
      .sort({ uploaded_at: -1 })

    return res.status(200).json(media)
  } catch (error) {
    console.error('Error en getMedia:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// GET /api/media/:id — solo admin
export const getMediaById = async (req, res) => {
  try {
    const media = await Media.findById(req.params.id)

    if (!media) {
      return res.status(404).json({ message: 'Imagen no encontrada' })
    }

    return res.status(200).json(media)
  } catch (error) {
    console.error('Error en getMediaById:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// GET /api/media/:id/archivo — público: devuelve el binario de la imagen
export const getMediaFile = async (req, res) => {
  try {
    const media = await Media.findById(req.params.id).select('+data mime_type url')

    if (!media) {
      return res.status(404).json({ message: 'Imagen no encontrada' })
    }

    if (media.data) {
      res.set('Content-Type', media.mime_type || 'application/octet-stream')
      res.set('Cache-Control', 'public, max-age=31536000, immutable')
      return res.send(media.data)
    }

    // Cloudinary o registros antiguos en base64
    if (media.url.startsWith('data:')) {
      const [meta, base64] = media.url.split(',')
      res.set('Content-Type', meta.slice(5).split(';')[0])
      res.set('Cache-Control', 'public, max-age=31536000, immutable')
      return res.send(Buffer.from(base64, 'base64'))
    }
    return res.redirect(media.url)
  } catch (error) {
    console.error('Error en getMediaFile:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// DELETE /api/media/:id — solo admin
export const deleteMedia = async (req, res) => {
  try {
    const id = req.params.id

    // No se borra una imagen que alguna cancha, producto o slide sigue usando
    const [canchas, productos, slides] = await Promise.all([
      Cancha.countDocuments({ imagen_id: id }),
      Producto.countDocuments({ imagen_id: id }),
      Carrusel.countDocuments({ imagen_id: id })
    ])
    const enUso = canchas + productos + slides
    if (enUso > 0) {
      return res.status(409).json({
        message: `La imagen está en uso (${canchas} canchas, ${productos} productos, ${slides} slides). Quítala de ahí antes de borrarla.`
      })
    }

    const media = await Media.findByIdAndDelete(id)

    if (!media) {
      return res.status(404).json({ message: 'Imagen no encontrada' })
    }

    if (media.public_id && cloudinaryEnabled()) {
      await destroyImage(media.public_id).catch(err =>
        console.error('No se pudo borrar de Cloudinary:', err)
      )
    }

    return res.status(200).json({ message: 'Imagen eliminada exitosamente' })
  } catch (error) {
    console.error('Error en deleteMedia:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}
