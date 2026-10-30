import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { resetPasswordApi, getErrorMessage } from '../../services/api'
// Reutiliza el diseño de la página de login
import '../Login/Login.css'

function ResetPassword() {
  const { token } = useParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
    if (password !== confirm) return setError('Las contraseñas no coinciden.')

    setLoading(true)
    try {
      const res = await resetPasswordApi(token, password)
      setDone(res.data.message)
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo restablecer la contraseña.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-header">
        <div className="container">
          <h1>Restablecer Contraseña</h1>
          <p>Elige una nueva contraseña para tu cuenta</p>
        </div>
      </div>

      <div className="container login-body">
        <div className="login-card">
          {done ? (
            <div className="login-form">
              <p style={{ color: '#1e7e34', display: 'flex', gap: 8, alignItems: 'center' }}>
                <i className="material-icons">check_circle</i>
                {done}
              </p>
              <Link to="/login" className="login-btn" style={{ textAlign: 'center', justifyContent: 'center' }}>
                Ir a iniciar sesión
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="login-form">
              {error && (
                <div className="login-error" role="alert" aria-live="polite">
                  <i className="material-icons" aria-hidden="true">error_outline</i>
                  <span>{error}</span>
                </div>
              )}

              <div className="login-field">
                <label htmlFor="new-password">Nueva contraseña</label>
                <div className="password-input-container">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="new-password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError('') }}
                    autoComplete="new-password"
                    required
                    className="login-input login-input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="password-toggle"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    <i className="material-icons">{showPassword ? 'visibility_off' : 'visibility'}</i>
                  </button>
                </div>
              </div>

              <div className="login-field">
                <label htmlFor="confirm-password">Confirmar contraseña</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="confirm-password"
                  value={confirm}
                  onChange={e => { setConfirm(e.target.value); setError('') }}
                  autoComplete="new-password"
                  required
                  className="login-input"
                />
              </div>

              <button type="submit" className={`login-btn ${loading ? 'login-btn-loading' : ''}`} disabled={loading}>
                <i className={`material-icons ${loading ? 'spinning' : ''}`} aria-hidden="true">
                  {loading ? 'refresh' : 'lock_reset'}
                </i>
                {loading ? 'Guardando...' : 'Guardar contraseña'}
              </button>

              <div className="login-links">
                <Link to="/login" className="forgot-password-link">Volver al inicio de sesión</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default ResetPassword
