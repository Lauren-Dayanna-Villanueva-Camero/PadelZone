import { Router } from 'express'
import {
  uploadMedia,
  getMedia,
  getMediaById,
  getMediaFile,
  deleteMedia
} from '../controllers/media.controller.js'
import { authRequired, adminRequired } from '../middlewares/auth.middleware.js'
import { validateId } from '../middlewares/validate.middleware.js'
import { upload } from '../middlewares/upload.middleware.js'

const router = Router()

// Pública: la usan las etiquetas <img>
router.get('/:id/archivo', validateId(), getMediaFile)

// Solo admin
router.get('/', authRequired, adminRequired, getMedia)
router.get('/:id', validateId(), authRequired, adminRequired, getMediaById)
router.post('/upload', authRequired, adminRequired, upload.single('imagen'), uploadMedia)
router.delete('/:id', validateId(), authRequired, adminRequired, deleteMedia)

export default router
