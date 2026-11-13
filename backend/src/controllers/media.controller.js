import Media from '../models/media.model.js'
import Cancha from '../models/cancha.model.js'
import Producto from '../models/producto.model.js'
import Carrusel from '../models/carrusel.model.js'
import User from '../models/user.model.js'
import { guardarImagen, borrarImagen } from '../libs/imagenes.js'

// Tipos que sube el admin. Las fotos de perfil ('avatar') las sube cada usuario
// desde PUT /api/auth/profile/foto y no aparecen en la galería
const tiposValidos = ['carrusel', 'cancha', 'producto', 'clase']

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

    const newMedia = await guardarImagen(req.file, { tipo, usuarioId: req.user._id })

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
    if (error.status) return res.status(error.status).json({ message: error.message })
    console.error('Error en uploadMedia:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// GET /api/media — solo admin (las páginas públicas reciben las imágenes ya pobladas)
export const getMedia = async (req, res) => {
  try {
    const { tipo } = req.query
    const filter = tiposValidos.includes(tipo) ? { tipo } : { tipo: { $ne: 'avatar' } }

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

    // No se borra una imagen que alguna cancha, producto, slide o perfil sigue usando
    const [canchas, productos, slides, perfiles] = await Promise.all([
      Cancha.countDocuments({ imagen_id: id }),
      Producto.countDocuments({ imagen_id: id }),
      Carrusel.countDocuments({ imagen_id: id }),
      User.countDocuments({ foto_id: id })
    ])
    if (perfiles > 0) {
      return res.status(409).json({ message: 'Es la foto de perfil de un usuario; solo él puede quitarla.' })
    }
    const enUso = canchas + productos + slides
    if (enUso > 0) {
      return res.status(409).json({
        message: `La imagen está en uso (${canchas} canchas, ${productos} productos, ${slides} slides). Quítala de ahí antes de borrarla.`
      })
    }

    const media = await borrarImagen(id)
    if (!media) {
      return res.status(404).json({ message: 'Imagen no encontrada' })
    }

    return res.status(200).json({ message: 'Imagen eliminada exitosamente' })
  } catch (error) {
    console.error('Error en deleteMedia:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}
