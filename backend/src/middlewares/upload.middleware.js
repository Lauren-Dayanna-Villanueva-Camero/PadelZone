import multer from 'multer'
import { MAX_SIZE_CLOUDINARY } from '../libs/cloudinary.js'

const storage = multer.memoryStorage()

const fileFilter = (req, file, cb) => {
  const tiposPermitidos = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

  if (tiposPermitidos.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Solo se permiten imágenes JPG, PNG o WEBP'), false)
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    // Tope general; el controlador aplica uno menor si se guarda en MongoDB
    fileSize: MAX_SIZE_CLOUDINARY
  }
})