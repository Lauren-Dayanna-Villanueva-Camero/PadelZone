import { Router } from 'express'
import {
  getPedidos,
  getPedidoById,
  createPedido,
  updateEstadoPedido,
  cancelarPedido
} from '../controllers/pedidos.controller.js'
import { authRequired, adminRequired } from '../middlewares/auth.middleware.js'
import { validateId } from '../middlewares/validate.middleware.js'

const router = Router()

router.get('/', authRequired, getPedidos)
router.get('/:id', validateId(), authRequired, getPedidoById)
router.post('/', authRequired, createPedido)
router.put('/:id/estado', validateId(), authRequired, adminRequired, updateEstadoPedido)
router.put('/:id/cancelar', validateId(), authRequired, cancelarPedido)

export default router