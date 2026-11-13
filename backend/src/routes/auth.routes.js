import { Router } from 'express'
import {
  register,
  login,
  logout,
  profile,
  updateProfile,
  forgotPassword,
  resetPassword,
  googleLogin,
  subirFoto,
  quitarFoto
} from '../controllers/auth.controller.js'
import { authRequired } from '../middlewares/auth.middleware.js'
import { rateLimit } from '../middlewares/rateLimit.middleware.js'
import { upload } from '../middlewares/upload.middleware.js'

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
const fotoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Cambiaste la foto muchas veces. Inténtalo más tarde.'
})

router.post('/register', accountLimiter, register)
router.post('/login', loginLimiter, login)
router.post('/google', loginLimiter, googleLogin)
router.post('/logout', logout)
router.post('/forgot-password', accountLimiter, forgotPassword)
router.post('/reset-password', loginLimiter, resetPassword)
router.get('/profile', authRequired, profile)
router.put('/profile', authRequired, updateProfile)
// Foto de perfil (campo de archivo 'imagen')
router.put('/profile/foto', authRequired, fotoLimiter, upload.single('imagen'), subirFoto)
router.delete('/profile/foto', authRequired, quitarFoto)

export default router
