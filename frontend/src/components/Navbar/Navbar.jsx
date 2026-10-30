import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import './Navbar.css'

function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const [servicesOpen, setServicesOpen] = useState(false)
  const dropdownRef = useRef(null)
  const { pathname } = useLocation()
  // Menú móvil: guarda la ruta en la que se abrió, así se cierra solo al navegar
  const [mobileOpenAt, setMobileOpenAt] = useState(null)
  const mobileOpen = mobileOpenAt === pathname
  const toggleMobile = () => setMobileOpenAt(mobileOpen ? null : pathname)

  const handleLogout = async () => {
    setMobileOpenAt(null)
    await logout()
    navigate('/')
  }

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setServicesOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <nav className="navbar-main">
      <div className="nav-wrapper container">

        <Link to="/" className="brand-logo">
          <img src="/IconPadel.png" alt="PadelZone Logo" className="nav-logo" />
          PadelZone
        </Link>

        <ul className="right hide-on-med-and-down">
          <li><Link to="/">Inicio</Link></li>
          <li><Link to="/canchas">Canchas</Link></li>

          <li className="nav-dropdown-wrapper" ref={dropdownRef}>
            <button
              className="nav-dropdown-trigger"
              onClick={() => setServicesOpen(!servicesOpen)}
            >
              Servicios
              <i className={`material-icons nav-chevron ${servicesOpen ? 'open' : ''}`}>
                expand_more
              </i>
            </button>

            {servicesOpen && (
              <div className="nav-dropdown-menu">
                <Link to="/reservar" className="nav-dropdown-item" onClick={() => setServicesOpen(false)}>
                  <i className="material-icons">event_available</i>
                  Reservas
                </Link>
                <Link to="/clases" className="nav-dropdown-item" onClick={() => setServicesOpen(false)}>
                  <i className="material-icons">sports_tennis</i>
                  Clases
                </Link>
                <Link to="/tiendas" className="nav-dropdown-item" onClick={() => setServicesOpen(false)}>
                  <i className="material-icons">storefront</i>
                  Tiendas
                </Link>
                <Link to="/torneos" className="nav-dropdown-item" onClick={() => setServicesOpen(false)}>
                  <i className="material-icons">emoji_events</i>
                  Torneos
                </Link>
                <Link to="/clima" className="nav-dropdown-item" onClick={() => setServicesOpen(false)}>
                  <i className="material-icons">wb_sunny</i>
                  Clima
                </Link>
              </div>
            )}
          </li>

          <li><Link to="/contacto">Contacto</Link></li>
          {isAdmin && (
            <li>
              <Link to="/admin">
                <i className="material-icons left">admin_panel_settings</i>
                Admin
              </Link>
            </li>
          )}
          <li>
            {isAuthenticated ? (
              <div className="nav-user">
                <Link to="/perfil" className="nav-user-name">
                  <i className="material-icons left">person</i>
                  {user?.nombre || 'Usuario'}
                </Link>
                <button className="btn-logout waves-effect" onClick={handleLogout}>
                  <i className="material-icons left">logout</i>
                  Cerrar Sesión
                </button>
              </div>
            ) : (
              <Link to="/login" className="btn-login">
                <i className="material-icons left">account_circle</i>
                Iniciar Sesión
              </Link>
            )}
          </li>
        </ul>

        <button
          className="nav-mobile-toggle hide-on-large-only"
          onClick={toggleMobile}
          aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={mobileOpen}
        >
          <i className="material-icons">{mobileOpen ? 'close' : 'menu'}</i>
        </button>

      </div>

      {mobileOpen && (
        <div className="nav-mobile-panel hide-on-large-only">
          <Link to="/"><i className="material-icons">home</i>Inicio</Link>
          <Link to="/canchas"><i className="material-icons">sports_tennis</i>Canchas</Link>
          <span className="nav-mobile-section">Servicios</span>
          <Link to="/reservar"><i className="material-icons">event_available</i>Reservas</Link>
          <Link to="/clases"><i className="material-icons">school</i>Clases</Link>
          <Link to="/tiendas"><i className="material-icons">storefront</i>Tiendas</Link>
          <Link to="/torneos"><i className="material-icons">emoji_events</i>Torneos</Link>
          <Link to="/clima"><i className="material-icons">wb_sunny</i>Clima</Link>
          <span className="nav-mobile-section" />
          <Link to="/contacto"><i className="material-icons">mail</i>Contacto</Link>
          {isAdmin && <Link to="/admin"><i className="material-icons">admin_panel_settings</i>Admin</Link>}
          {isAuthenticated ? (
            <>
              <Link to="/perfil"><i className="material-icons">person</i>{user?.nombre || 'Mi perfil'}</Link>
              <button className="nav-mobile-logout" onClick={handleLogout}>
                <i className="material-icons">logout</i>Cerrar Sesión
              </button>
            </>
          ) : (
            <Link to="/login" className="nav-mobile-login">
              <i className="material-icons">account_circle</i>Iniciar Sesión
            </Link>
          )}
        </div>
      )}
    </nav>
  )
}

export default Navbar

