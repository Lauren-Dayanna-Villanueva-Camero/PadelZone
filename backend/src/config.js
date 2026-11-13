export const PORT = process.env.PORT || 5000
export const MONGODB_URI = process.env.MONGODB_URI
export const JWT_SECRET = process.env.JWT_SECRET
export const NODE_ENV = process.env.NODE_ENV || 'development'
export const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'

// Correo (Gmail con contraseña de aplicación). Sin estas variables los correos
// no se envían y, fuera de producción, el enlace de recuperación se muestra en consola
export const GMAIL_USER = process.env.GMAIL_USER || ''
export const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '')
export const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || 'PadelZone'

// Inicio de sesión con Google: ID de cliente OAuth (el mismo que usa el frontend)
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''

// Pagos en línea con Wompi (opcional). Llaves del panel de Wompi → Desarrolladores.
// Con llaves pub_test_ se usa el sandbox. Sin llaves los pagos en línea son simulados.
export const WOMPI_PUBLIC_KEY = (process.env.WOMPI_PUBLIC_KEY || '').trim()
export const WOMPI_INTEGRITY_SECRET = (process.env.WOMPI_INTEGRITY_SECRET || '').trim()
// Secreto de eventos: valida el webhook POST /api/pagos/wompi/eventos
export const WOMPI_EVENTS_SECRET = (process.env.WOMPI_EVENTS_SECRET || '').trim()
