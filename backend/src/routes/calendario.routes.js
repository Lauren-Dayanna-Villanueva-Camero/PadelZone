import { Router } from 'express'
import { getCalendario } from '../controllers/calendario.controller.js'
import { authRequired } from '../middlewares/auth.middleware.js'

const router = Router()

// Admin: todo el club. Usuario: sus reservas, partidos, torneos y clases
router.get('/', authRequired, getCalendario)

export default router
