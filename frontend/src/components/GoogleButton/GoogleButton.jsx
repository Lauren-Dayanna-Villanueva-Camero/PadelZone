import { useState } from 'react'
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../../hooks/useAuth'
import { getErrorMessage } from '../../services/api'
import './GoogleButton.css'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

// Botón "Continuar con Google" (Google Identity Services). Google entrega un ID
// token que el backend verifica; si el email no tiene cuenta, se crea.
// Sin VITE_GOOGLE_CLIENT_ID no se muestra nada. El script de Google solo se
// carga en las páginas que usan este botón (login y registro).
function GoogleButton({ texto = 'continue_with', onError }) {
  const { loginWithGoogle } = useAuth()
  const [cargando, setCargando] = useState(false)

  if (!CLIENT_ID) return null

  const handleSuccess = async ({ credential }) => {
    if (!credential) {
      onError?.('Google no devolvió la credencial. Inténtalo de nuevo.')
      return
    }
    setCargando(true)
    onError?.('')
    try {
      await loginWithGoogle(credential)
      // La redirección la hace PublicRoute al detectar la sesión
    } catch (err) {
      onError?.(getErrorMessage(err, 'No se pudo iniciar sesión con Google.'))
      setCargando(false)
    }
  }

  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <div className={`google-btn-wrap ${cargando ? 'is-loading' : ''}`} aria-busy={cargando}>
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => onError?.('No se pudo conectar con Google. Inténtalo de nuevo.')}
          text={texto}
          shape="pill"
          size="large"
          width="320"
          locale="es"
        />
        {cargando && (
          <span className="google-btn-cargando">
            <i className="material-icons spinning" aria-hidden="true">refresh</i>
            Entrando con Google...
          </span>
        )}
      </div>
    </GoogleOAuthProvider>
  )
}

export default GoogleButton
