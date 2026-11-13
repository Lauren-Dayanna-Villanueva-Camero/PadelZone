import { Router } from 'express'
import { getMisMultas, getMultas, anularMultaCtrl } from '../controllers/multas.controller.js'
import { authRequired, adminRequired } from '../middlewares/auth.middleware.js'
import { validateId } from '../middlewares/validate.middleware.js'

const router = Router()

router.get('/mias', authRequired, getMisMultas)
router.get('/', authRequired, adminRequired, getMultas)
router.put('/:id/anular', validateId(), authRequired, adminRequired, anularMultaCtrl)

export default router
