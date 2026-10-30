import { Router } from 'express'
import {
  register,
  login,
  logout,
  profile,
  updateProfile,
  forgotPassword,
  resetPassword
} from '../controllers/auth.controller.js'
import { authRequired } from '../middlewares/auth.middleware.js'
import { rateLimit } from '../middlewares/rateLimit.middleware.js'

const router = Router()

// Frena ataques de fuerza bruta contra contraseñas y el envío masivo de enlaces
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'
})
const accountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Demasiadas solicitudes. Inténtalo más tarde.'
})

router.post('/register', accountLimiter, register)
router.post('/login', loginLimiter, login)
router.post('/logout', logout)
router.post('/forgot-password', accountLimiter, forgotPassword)
router.post('/reset-password', loginLimiter, resetPassword)
router.get('/profile', authRequired, profile)
router.put('/profile', authRequired, updateProfile)

export default router
