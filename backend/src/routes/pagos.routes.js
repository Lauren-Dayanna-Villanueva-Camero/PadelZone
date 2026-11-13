import { Router } from 'express'
import {
  getConfig,
  crearPago,
  simularPago,
  verificarWompi,
  webhookWompi,
  getMisPagos,
  getPagoById,
  getPagos,
  confirmarPago,
  anularPago
} from '../controllers/pagos.controller.js'
import { authRequired, adminRequired } from '../middlewares/auth.middleware.js'
import { validateId } from '../middlewares/validate.middleware.js'
import { rateLimit } from '../middlewares/rateLimit.middleware.js'

const router = Router()

const limitePagos = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: 'Demasiados intentos de pago. Espera unos minutos e inténtalo de nuevo.'
})

// Públicas (el webhook lo llama Wompi y se valida con la firma del evento)
router.get('/config', getConfig)
router.post('/wompi/eventos', webhookWompi)

// Rutas fijas antes de '/:id'
router.get('/mios', authRequired, getMisPagos)
router.get('/wompi/verificar', authRequired, verificarWompi)

router.post('/', limitePagos, authRequired, crearPago)
router.post('/:id/simular', validateId(), limitePagos, authRequired, simularPago)

// Solo admin
router.get('/', authRequired, adminRequired, getPagos)
router.put('/:id/confirmar', validateId(), authRequired, adminRequired, confirmarPago)
router.put('/:id/anular', validateId(), authRequired, adminRequired, anularPago)

router.get('/:id', validateId(), authRequired, getPagoById)

export default router
