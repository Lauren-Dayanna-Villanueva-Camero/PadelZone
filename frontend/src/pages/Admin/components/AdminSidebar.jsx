import { NavLink } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth'
import './AdminSidebar.css'

const links = [
  { to: '/admin', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/admin/reservas', label: 'Reservas', icon: 'event_available' },
  { to: '/admin/pedidos', label: 'Pedidos', icon: 'receipt_long' },
  { to: '/admin/canchas', label: 'Canchas', icon: 'sports_tennis' },
  { to: '/admin/productos', label: 'Productos', icon: 'shopping_bag' },
  { to: '/admin/torneos', label: 'Torneos', icon: 'emoji_events' },
  { to: '/admin/carrusel', label: 'Carrusel', icon: 'view_carousel' },
  { to: '/admin/media', label: 'Imágenes', icon: 'photo_library' },
  { to: '/admin/usuarios', label: 'Usuarios', icon: 'group' },
]

function AdminSidebar() {
  const { user } = useAuth()

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-logo">
        <img src="/IconPadel.png" alt="PadelZone" />
        <span>Admin</span>
      </div>

      <nav className="admin-sidebar-nav">
        {links.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `admin-nav-link ${isActive ? 'active' : ''}`
            }
          >
            <i className="material-icons">{link.icon}</i>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="admin-sidebar-footer">
        {user && <p className="admin-sidebar-user">{user.nombre} {user.apellido}</p>}
        <NavLink to="/" className="admin-nav-link">
          <i className="material-icons">arrow_back</i>
          <span>Volver al sitio</span>
        </NavLink>
      </div>
    </aside>
  )
}

export default AdminSidebar
