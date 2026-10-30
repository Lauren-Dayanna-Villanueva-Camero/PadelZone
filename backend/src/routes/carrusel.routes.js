import { Router } from 'express'
import {
  getCarrusel,
  createSlide,
  updateSlide,
  deleteSlide
} from '../controllers/carrusel.controller.js'
import { authRequired, adminRequired, optionalAuth } from '../middlewares/auth.middleware.js'
import { validateId } from '../middlewares/validate.middleware.js'

const router = Router()

router.get('/', optionalAuth, getCarrusel)
router.post('/', authRequired, adminRequired, createSlide)
router.put('/:id', validateId(), authRequired, adminRequired, updateSlide)
router.delete('/:id', validateId(), authRequired, adminRequired, deleteSlide)

export default router