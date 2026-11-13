import bcrypt from 'bcryptjs'
import User from '../models/user.model.js'
import { createToken } from '../libs/jwt.js'
import crypto from 'crypto'
import {
  registerSchema,
  loginSchema,
  profileUpdateSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  googleLoginSchema
} from '../schema/auth.schema.js'
import { CLIENT_URL, NODE_ENV } from '../config.js'
import { mailEnabled, enviarCorreoRecuperacion, enviarCorreoContrasenaCambiada } from '../libs/mailer.js'
import { verificarCredencialGoogle } from '../libs/google.js'

const RESET_TOKEN_TTL = 60 * 60 * 1000 // 1 hora
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')

// Mismas opciones al crear y al borrar la cookie, si no el navegador no la elimina
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict'
}
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000 // 7 días

// Datos del usuario que se devuelven al iniciar sesión (sin hashes ni tokens)
const datosSesion = (user) => ({
  id: user._id,
  nombre: user.nombre,
  apellido: user.apellido,
  email: user.email,
  telefono: user.telefono,
  rol: user.rol,
  tiene_password: Boolean(user.password_hash),
  google: Boolean(user.google_id)
})

// Crea el JWT y lo deja en la cookie httpOnly
const abrirSesion = async (res, user) => {
  const token = await createToken({ id: user._id, rol: user.rol })
  res.cookie('token', token, { ...cookieOptions, maxAge: COOKIE_MAX_AGE })
}

// POST /api/auth/register
export const register = async (req, res) => {
  try {
    // Validar con zod
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Datos inválidos',
        errors: parsed.error.issues.map(e => e.message)
      })
    }

    const { nombre, apellido, email, password, telefono } = parsed.data

    // Verificar si ya existe
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(409).json({ message: 'El email ya está registrado' })
    }

    // Hashear contraseña
    const salt = await bcrypt.genSalt(10)
    const password_hash = await bcrypt.hash(password, salt)

    // Crear usuario
    const newUser = new User({
      nombre,
      apellido,
      email,
      password_hash,
      telefono
    })

    await newUser.save()

    await abrirSesion(res, newUser)

    return res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: datosSesion(newUser)
    })

  } catch (error) {
    console.error('Error en register:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// POST /api/auth/login
export const login = async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Datos inválidos',
        errors: parsed.error.issues.map(e => e.message)
      })
    }

    const { email, password } = parsed.data

    // Buscar usuario
    const user = await User.findOne({ email })
    if (!user) {
      return res.status(401).json({ message: 'Credenciales incorrectas' })
    }

    if (!user.activo) {
      return res.status(403).json({ message: 'Cuenta desactivada' })
    }

    // Cuenta creada con Google que aún no tiene contraseña
    if (!user.password_hash) {
      return res.status(401).json({
        message: 'Esta cuenta se creó con Google. Usa "Continuar con Google" o crea una contraseña con "¿Olvidaste tu contraseña?".'
      })
    }

    // Verificar contraseña
    const isMatch = await bcrypt.compare(password, user.password_hash)
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciales incorrectas' })
    }

    await abrirSesion(res, user)

    return res.status(200).json({
      message: 'Login exitoso',
      user: datosSesion(user)
    })

  } catch (error) {
    console.error('Error en login:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// POST /api/auth/google — inicia sesión o crea la cuenta con el ID token de Google.
// Si ya hay una cuenta con ese email (creada con contraseña), se vincula a Google.
export const googleLogin = async (req, res) => {
  try {
    const parsed = googleLoginSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Datos inválidos',
        errors: parsed.error.issues.map(e => e.message)
      })
    }

    const google = await verificarCredencialGoogle(parsed.data.credential)

    let user = await User.findOne({ google_id: google.google_id }) ||
      await User.findOne({ email: google.email })
    let nuevo = false

    if (user) {
      if (!user.activo) {
        return res.status(403).json({ message: 'Cuenta desactivada' })
      }
      // Primera vez con Google en una cuenta que ya existía: se vincula
      if (!user.google_id) {
        user.google_id = google.google_id
        await user.save()
      }
    } else {
      user = await User.create({
        nombre: google.nombre,
        apellido: google.apellido,
        email: google.email,
        google_id: google.google_id
      })
      nuevo = true
    }

    await abrirSesion(res, user)

    return res.status(nuevo ? 201 : 200).json({
      message: nuevo ? 'Cuenta creada con Google' : 'Login exitoso',
      nuevo,
      user: datosSesion(user)
    })
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message })
    console.error('Error en googleLogin:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// POST /api/auth/logout
export const logout = (req, res) => {
  res.clearCookie('token', cookieOptions)
  return res.status(200).json({ message: 'Sesión cerrada exitosamente' })
}

// GET /api/auth/profile
export const profile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' })
    }
    const { password_hash: hash, ...datos } = user.toObject()
    return res.status(200).json({ ...datos, tiene_password: Boolean(hash), google: Boolean(user.google_id) })
  } catch (error) {
    console.error('Error en profile:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// POST /api/auth/forgot-password
// Responde siempre lo mismo para no revelar qué emails están registrados
export const forgotPassword = async (req, res) => {
  const generic = { message: 'Si el email está registrado, recibirás un enlace para restablecer tu contraseña.' }
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Datos inválidos',
        errors: parsed.error.issues.map(e => e.message)
      })
    }

    const user = await User.findOne({ email: parsed.data.email, activo: true })
    if (!user) return res.status(200).json(generic)

    const token = crypto.randomBytes(32).toString('hex')
    user.reset_token_hash = hashToken(token)
    user.reset_token_expira = new Date(Date.now() + RESET_TOKEN_TTL)
    await user.save()

    const resetUrl = `${CLIENT_URL}/restablecer/${token}`

    if (mailEnabled()) {
      try {
        await enviarCorreoRecuperacion({
          para: user.email,
          nombre: user.nombre,
          url: resetUrl,
          minutos: RESET_TOKEN_TTL / 60000
        })
        return res.status(200).json(generic)
      } catch (error) {
        console.error(`No se pudo enviar el correo de recuperación a ${user.email}:`, error.message)
        if (NODE_ENV === 'production') {
          return res.status(503).json({ message: 'No pudimos enviar el correo en este momento. Inténtalo más tarde.' })
        }
      }
    }

    // Sin correo configurado (o si falló en desarrollo) el enlace se muestra en
    // consola y en la respuesta, para poder probar el flujo
    if (NODE_ENV !== 'production') {
      console.log(`[DEV] Enlace para restablecer contraseña de ${user.email}: ${resetUrl}`)
      return res.status(200).json({ ...generic, dev_reset_url: resetUrl })
    }

    console.warn(`Correo no configurado: no se pudo enviar el enlace de recuperación a ${user.email}`)
    return res.status(200).json(generic)
  } catch (error) {
    console.error('Error en forgotPassword:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// POST /api/auth/reset-password
export const resetPassword = async (req, res) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Datos inválidos',
        errors: parsed.error.issues.map(e => e.message)
      })
    }

    const user = await User.findOne({
      reset_token_hash: hashToken(parsed.data.token),
      reset_token_expira: { $gt: new Date() }
    })

    if (!user) {
      return res.status(400).json({ message: 'El enlace no es válido o ya expiró. Solicita uno nuevo.' })
    }

    user.password_hash = await bcrypt.hash(parsed.data.password, 10)
    user.reset_token_hash = undefined
    user.reset_token_expira = undefined
    await user.save()

    // Aviso por correo; si falla no se interrumpe el cambio de contraseña
    if (mailEnabled()) {
      enviarCorreoContrasenaCambiada({ para: user.email, nombre: user.nombre, urlLogin: `${CLIENT_URL}/login` })
        .catch(error => console.error(`No se pudo enviar el aviso de contraseña cambiada a ${user.email}:`, error.message))
    }

    return res.status(200).json({ message: 'Contraseña actualizada. Ya puedes iniciar sesión.' })
  } catch (error) {
    console.error('Error en resetPassword:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// PUT /api/auth/profile — el usuario edita sus propios datos (no puede cambiar rol ni email)
export const updateProfile = async (req, res) => {
  try {
    const parsed = profileUpdateSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Datos inválidos',
        errors: parsed.error.issues.map(e => e.message)
      })
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      parsed.data,
      { new: true, runValidators: true }
    )

    return res.status(200).json({ message: 'Perfil actualizado', user: datosSesion(user) })
  } catch (error) {
    console.error('Error en updateProfile:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}