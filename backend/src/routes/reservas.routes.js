import { Router } from 'express'
import {
  getReservas,
  getReservaById,
  createReserva,
  cancelarReserva,
  deleteReserva,
  getHorariosOcupados
} from '../controllers/reservas.controller.js'
import { marcarNoAsistio, desmarcarNoAsistio } from '../controllers/multas.controller.js'
import { authRequired, adminRequired } from '../middlewares/auth.middleware.js'
import { validateId } from '../middlewares/validate.middleware.js'

const router = Router()

// Pública: debe ir antes de '/:id'
router.get('/ocupados', getHorariosOcupados)

// El resto requieren autenticación
router.get('/', authRequired, getReservas)
router.get('/:id', validateId(), authRequired, getReservaById)
router.post('/', authRequired, createReserva)
router.put('/:id/cancelar', validateId(), authRequired, cancelarReserva)
router.delete('/:id', validateId(), authRequired, adminRequired, deleteReserva)
// El usuario no llegó a una reserva que iba a pagar en la sede: multa
router.put('/:id/no-asistio', validateId(), authRequired, adminRequired, marcarNoAsistio)
router.delete('/:id/no-asistio', validateId(), authRequired, adminRequired, desmarcarNoAsistio)

export default router