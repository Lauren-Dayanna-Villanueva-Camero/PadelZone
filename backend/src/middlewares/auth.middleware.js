import { verifyToken } from '../libs/jwt.js'
import User from '../models/user.model.js'

export const authRequired = async (req, res, next) => {
  try {
    const { token } = req.cookies

    if (!token) {
      return res.status(401).json({ message: 'No autorizado — token requerido' })
    }

    const decoded = await verifyToken(token)
    const user = await User.findById(decoded.id).select('-password_hash')

    if (!user) {
      return res.status(401).json({ message: 'Usuario no encontrado' })
    }

    if (!user.activo) {
      return res.status(403).json({ message: 'Cuenta desactivada' })
    }

    req.user = user
    next()

  } catch (error) {
    return res.status(401).json({ message: 'Token inválido o expirado' })
  }
}

// Para rutas públicas que muestran más datos a un admin: si hay sesión válida
// rellena req.user, pero nunca rechaza la petición
export const optionalAuth = async (req, res, next) => {
  try {
    const { token } = req.cookies
    if (token) {
      const decoded = await verifyToken(token)
      const user = await User.findById(decoded.id).select('-password_hash')
      if (user?.activo) req.user = user
    }
  } catch {
    // token inválido: se trata como visitante anónimo
  }
  next()
}

export const isAdminRequest = (req) => req.user?.rol === 'admin'

export const adminRequired = (req, res, next) => {
  if (!req.user || req.user.rol !== 'admin') {
    return res.status(403).json({ message: 'Acceso denegado — se requiere rol admin' })
  }
  next()
}