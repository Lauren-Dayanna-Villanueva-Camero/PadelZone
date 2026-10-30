import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { getErrorMessage } from '../../services/api'
import './Register.css'
import '../../styles/auth.css'

function Register() {
  const [form, setForm] = useState({
    name: '',
    apellido: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)

  const { register } = useAuth()

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  const toggleShowPassword = () => {
    setShowPassword(!showPassword)
  }

  const toggleShowConfirmPassword = () => {
    setShowConfirmPassword(!showConfirmPassword)
  }

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const validatePassword = (password) => {
    return password.length >= 6
  }

  const validateName = (name) => {
    return name.trim().length >= 2
  }

  const validatePhone = (phone) => {
    const phoneRegex = /^[+]?[0-9\s\-()]{8,}$/
    return phoneRegex.test(phone.replace(/\s/g, ''))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Validaciones
    if (!form.name || !form.apellido || !form.email || !form.password || !form.confirmPassword) {
      setError('Por favor completa todos los campos requeridos.')
      return
    }

    if (!validateName(form.name)) {
      setError('El nombre debe tener al menos 2 caracteres.')
      return
    }

    if (!validateName(form.apellido)) {
      setError('El apellido debe tener al menos 2 caracteres.')
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

    if (form.password !== form.confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    if (form.phone && !validatePhone(form.phone)) {
      setError('Por favor ingresa un número de teléfono válido.')
      return
    }

    if (!acceptTerms) {
      setError('Debes aceptar los términos y condiciones.')
      return
    }

    setLoading(true)

    try {
      // El backend crea la cookie de sesión; PublicRoute redirige al detectar el usuario
      await register({
        nombre: form.name.trim(),
        apellido: form.apellido.trim(),
        email: form.email.trim(),
        password: form.password,
        telefono: form.phone.trim() || undefined
      })
    } catch (err) {
      setError(getErrorMessage(err, 'Error al registrarse. Inténtalo de nuevo.'))
      setLoading(false)
    }
  }

  return (
    <div className="register-page">
      {/* Header */}
      <div className="register-header">
        <div className="container">
          <h1>Crear Cuenta</h1>
          <p>Únete a PadelZone y comienza a reservar canchas</p>
        </div>
      </div>

      {/* Contenido */}
      <div className="container register-body">
        <div className="register-card">
          <form onSubmit={handleSubmit} className="register-form" role="form" aria-labelledby="register-title">
            {error && (
              <div className="register-error" role="alert" aria-live="polite">
                <i className="material-icons" aria-hidden="true">error_outline</i>
                <span>{error}</span>
              </div>
            )}

            {/* Name */}
            <div className="register-field">
              <label htmlFor="name">Nombre *</label>
              <input
                type="text"
                id="name"
                name="name"
                placeholder="Tu nombre"
                value={form.name}
                onChange={handleChange}
                autoComplete="given-name"
                aria-invalid={error.includes('nombre') ? 'true' : 'false'}
                required
                className="register-input"
              />
            </div>

            {/* Apellido */}
            <div className="register-field">
              <label htmlFor="apellido">Apellido *</label>
              <input
                type="text"
                id="apellido"
                name="apellido"
                placeholder="Tu apellido"
                value={form.apellido}
                onChange={handleChange}
                autoComplete="family-name"
                aria-invalid={error.includes('apellido') ? 'true' : 'false'}
                required
                className="register-input"
              />
            </div>

            {/* Email */}
            <div className="register-field">
              <label htmlFor="email">Email *</label>
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
                className="register-input"
              />
            </div>

            {/* Phone */}
            <div className="register-field">
              <label htmlFor="phone">Teléfono</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                placeholder="+56 9 1234 5678"
                value={form.phone}
                onChange={handleChange}
                autoComplete="tel"
                className="register-input"
              />
            </div>

            {/* Password */}
            <div className="register-field">
              <label htmlFor="password">Contraseña *</label>
              <div className="password-input-container">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  aria-invalid={error.includes('contraseña') ? 'true' : 'false'}
                  required
                  className="register-input register-input-password"
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

            {/* Confirm Password */}
            <div className="register-field">
              <label htmlFor="confirmPassword">Confirmar contraseña *</label>
              <div className="password-input-container">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  name="confirmPassword"
                  placeholder="••••••••"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                  aria-invalid={error.includes('coinciden') ? 'true' : 'false'}
                  required
                  className="register-input register-input-password"
                />
                <button
                  type="button"
                  onClick={toggleShowConfirmPassword}
                  className="password-toggle"
                  aria-label={showConfirmPassword ? "Ocultar confirmación" : "Mostrar confirmación"}
                >
                  <i className="material-icons">
                    {showConfirmPassword ? 'visibility_off' : 'visibility'}
                  </i>
                </button>
              </div>
            </div>

            {/* Terms and Conditions */}
            <div className="register-field">
              <label className="checkbox-container">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  required
                  className="checkbox-input"
                />
                <span className="checkbox-text">
                  Acepto los <a href="#" className="terms-link">términos y condiciones</a> y la <a href="#" className="terms-link">política de privacidad</a>
                </span>
              </label>
            </div>

            <button
              type="submit"
              className={`register-btn ${loading ? 'register-btn-loading' : ''}`}
              disabled={loading}
            >
              {loading ? (
                <>
                  <i className="material-icons spinning" aria-hidden="true">refresh</i>
                  Creando cuenta...
                </>
              ) : (
                <>
                  <i className="material-icons" aria-hidden="true">person_add</i>
                  Crear Cuenta
                </>
              )}
            </button>

            <div className="register-links">
              <p>¿Ya tienes cuenta? <Link to="/login" className="login-link">Inicia sesión</Link></p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Register