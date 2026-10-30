import { Router } from 'express'
import { getStats, getUsuarios, updateUsuario } from '../controllers/admin.controller.js'
import { authRequired, adminRequired } from '../middlewares/auth.middleware.js'
import { validateId } from '../middlewares/validate.middleware.js'

const router = Router()

// Todas las rutas de este archivo son solo para admin
router.use(authRequired, adminRequired)

router.get('/stats', getStats)
router.get('/usuarios', getUsuarios)
router.put('/usuarios/:id', validateId(), updateUsuario)

export default router
