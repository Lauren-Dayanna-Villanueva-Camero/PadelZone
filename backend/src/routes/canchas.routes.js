import { Router } from 'express'
import {
  getCanchas,
  getCanchaById,
  createCancha,
  updateCancha,
  deleteCancha
} from '../controllers/canchas.controller.js'
import { authRequired, adminRequired, optionalAuth } from '../middlewares/auth.middleware.js'
import { validateId } from '../middlewares/validate.middleware.js'

const router = Router()

// Rutas públicas
router.get('/', optionalAuth, getCanchas)
router.get('/:id', validateId(), getCanchaById)

// Rutas solo admin
router.post('/', authRequired, adminRequired, createCancha)
router.put('/:id', validateId(), authRequired, adminRequired, updateCancha)
router.delete('/:id', validateId(), authRequired, adminRequired, deleteCancha)

export default router