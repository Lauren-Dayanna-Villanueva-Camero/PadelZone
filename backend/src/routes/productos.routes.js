import { Router } from 'express'
import {
  getProductos,
  getProductoById,
  createProducto,
  updateProducto,
  deleteProducto
} from '../controllers/productos.controller.js'
import { authRequired, adminRequired, optionalAuth } from '../middlewares/auth.middleware.js'
import { validateId } from '../middlewares/validate.middleware.js'

const router = Router()

// Rutas públicas
router.get('/', optionalAuth, getProductos)
router.get('/:id', validateId(), getProductoById)

// Rutas solo admin
router.post('/', authRequired, adminRequired, createProducto)
router.put('/:id', validateId(), authRequired, adminRequired, updateProducto)
router.delete('/:id', validateId(), authRequired, adminRequired, deleteProducto)

export default router