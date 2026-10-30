import { Router } from 'express'
import {
  getMisInscripciones,
  getInscripciones,
  createInscripcion,
  cancelarInscripcion
} from '../controllers/clases.controller.js'
import { authRequired, adminRequired } from '../middlewares/auth.middleware.js'
import { validateId } from '../middlewares/validate.middleware.js'

const router = Router()

router.get('/mis-inscripciones', authRequired, getMisInscripciones)
router.get('/inscripciones', authRequired, adminRequired, getInscripciones)
router.post('/inscripciones', authRequired, createInscripcion)
router.put('/inscripciones/:id/cancelar', validateId(), authRequired, cancelarInscripcion)

export default router
