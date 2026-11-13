import { OAuth2Client } from 'google-auth-library'
import { GOOGLE_CLIENT_ID } from '../config.js'

// Inicio de sesión con Google (Google Identity Services). El frontend muestra el
// botón de Google y recibe un "ID token" (JWT firmado por Google); aquí se
// verifica la firma, que sea para nuestro Client ID y que no haya expirado.
// Solo se necesita el Client ID: no hay secreto de cliente que proteger.

const cliente = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null

export const googleEnabled = () => Boolean(cliente)

// Devuelve los datos del usuario de Google o lanza un Error con `status`
export const verificarCredencialGoogle = async (credential) => {
  if (!cliente) {
    const error = new Error('El inicio de sesión con Google no está configurado')
    error.status = 503
    throw error
  }

  let payload
  try {
    const ticket = await cliente.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID })
    payload = ticket.getPayload()
  } catch {
    const error = new Error('No se pudo verificar la cuenta de Google. Inténtalo de nuevo.')
    error.status = 401
    throw error
  }

  // Sin email verificado no se puede vincular con seguridad a una cuenta existente
  if (!payload?.email || !payload.email_verified) {
    const error = new Error('Tu cuenta de Google no tiene un email verificado')
    error.status = 401
    throw error
  }

  return {
    google_id: payload.sub,
    email: payload.email.toLowerCase(),
    nombre: payload.given_name || payload.name || payload.email.split('@')[0],
    apellido: payload.family_name || ''
  }
}
