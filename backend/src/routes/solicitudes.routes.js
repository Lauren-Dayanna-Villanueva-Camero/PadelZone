import { Router } from 'express'
import {
  cotizar,
  createSolicitud,
  getMisSolicitudes,
  cancelarSolicitud,
  getSolicitudes,
  aprobarSolicitud,
  rechazarSolicitud
} from '../controllers/solicitudes.controller.js'
import { authRequired, adminRequired } from '../middlewares/auth.middleware.js'
import { validateId } from '../middlewares/validate.middleware.js'

const router = Router()

// Usuario autenticado (empresa u organizador)
router.post('/cotizar', authRequired, cotizar)
router.get('/mias', authRequired, getMisSolicitudes)
router.post('/', authRequired, createSolicitud)
router.put('/:id/cancelar', validateId(), authRequired, cancelarSolicitud)

// Solo admin
router.get('/', authRequired, adminRequired, getSolicitudes)
router.put('/:id/aprobar', validateId(), authRequired, adminRequired, aprobarSolicitud)
router.put('/:id/rechazar', validateId(), authRequired, adminRequired, rechazarSolicitud)

export default router
