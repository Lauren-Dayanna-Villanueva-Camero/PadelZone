import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { getErrorMessage } from '../../services/api'
import ForgotPassword from '../../components/ForgotPassword/ForgotPassword'
import './Login.css'
import '../../styles/auth.css'

function Login() {
  const [form, setForm] = useState({
    email: localStorage.getItem('rememberedEmail') || '',
    password: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberEmail, setRememberEmail] = useState(!!localStorage.getItem('rememberedEmail'))
  const [showForgotPassword, setShowForgotPassword] = useState(false)

  const { login } = useAuth()

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  const handleRememberEmailChange = (e) => {
    setRememberEmail(e.target.checked)
    if (!e.target.checked) {
      localStorage.removeItem('rememberedEmail')
    }
  }

  const toggleShowPassword = () => {
    setShowPassword(!showPassword)
  }

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const validatePassword = (password) => {
    return password.length >= 6
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!form.email || !form.password) {
      setError('Por favor completa todos los campos.')
      return
    }

    if (!validateEmail(form.email)) {
      setError('Por favor ingresa un email válido.')
      return
    }

    if (!validatePassword(form.password)) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setLoading(true)

    try {
      await login({ email: form.email.trim(), password: form.password })

      if (rememberEmail) {
        localStorage.setItem('rememberedEmail', form.email.trim())
      }
      // La redirección la hace PublicRoute al detectar la sesión
    } catch (err) {
      setError(getErrorMessage(err, 'Error al iniciar sesión. Inténtalo de nuevo.'))
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-header">
        <div className="container">
          <h1>Iniciar Sesión</h1>
          <p>Accede a tu cuenta para hacer reservas</p>
        </div>
      </div>

      <div className="container login-body">
        <div className="login-card">
          <form onSubmit={handleSubmit} className="login-form" role="form" aria-labelledby="login-title">
            {error && (
              <div className="login-error" role="alert" aria-live="polite">
                <i className="material-icons" aria-hidden="true">error_outline</i>
                <span>{error}</span>
              </div>
            )}

            <div className="login-field">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="tu@email.com"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                aria-invalid={error.toLowerCase().includes('email') ? 'true' : 'false'}
                required
                className="login-input"
              />
            </div>

            <div className="login-field">
              <label htmlFor="password">Contraseña</label>
              <div className="password-input-container">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  aria-invalid={error.includes('contraseña') ? 'true' : 'false'}
                  required
                  className="login-input login-input-password"
                />
                <button
                  type="button"
                  onClick={toggleShowPassword}
                  className="password-toggle"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  <i className="material-icons">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </i>
                </button>
              </div>
            </div>

            <div className="login-field">
              <label className="checkbox-container">
                <input
                  type="checkbox"
                  checked={rememberEmail}
                  onChange={handleRememberEmailChange}
                  className="checkbox-input"
                />
                <span className="checkbox-text">Recordar mi email</span>
              </label>
            </div>

            <button
              type="submit"
              className={`login-btn ${loading ? 'login-btn-loading' : ''}`}
              disabled={loading}
            >
              {loading ? (
                <>
                  <i className="material-icons spinning" aria-hidden="true">refresh</i>
                  Iniciando sesión...
                </>
              ) : (
                <>
                  <i className="material-icons" aria-hidden="true">login</i>
                  Iniciar Sesión
                </>
              )}
            </button>

            <div className="login-links">
              <button
                type="button"
                className="forgot-password-link"
                onClick={() => setShowForgotPassword(true)}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

          </form>

          <div className="login-divider">
            <span>o</span>
          </div>

          <div className="login-guest">
            <p>¿No tienes cuenta?</p>
            <Link to="/registro" className="login-btn-guest">
              <i className="material-icons" aria-hidden="true">person_add</i>
              Crear Cuenta
            </Link>
          </div>
        </div>
      </div>

      <ForgotPassword
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />
    </div>
  )
}

export default Login