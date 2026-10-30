import { Link } from 'react-router-dom'
import { useAdmin } from '../../../hooks/useAdmin'
import './Dashboard.css'

const statCards = [
  { key: 'reservas', label: 'Reservas vigentes', icon: 'event_available', color: '#00897b', to: '/admin/reservas' },
  { key: 'pedidos', label: 'Pedidos pendientes', icon: 'receipt_long', color: '#ef6c00', to: '/admin/pedidos' },
  { key: 'canchas', label: 'Canchas activas', icon: 'sports_tennis', color: '#010231', to: '/admin/canchas' },
  { key: 'productos', label: 'Productos activos', icon: 'shopping_bag', color: '#1565c0', to: '/admin/productos' },
  { key: 'torneos', label: 'Torneos activos', icon: 'emoji_events', color: '#6a1b9a', to: '/admin/torneos' },
  { key: 'usuarios', label: 'Usuarios', icon: 'group', color: '#f57c00', to: '/admin/usuarios' },
  { key: 'media', label: 'Imágenes subidas', icon: 'photo_library', color: '#e53935', to: '/admin/media' },
]

const quickActions = [
  { to: '/admin/reservas', icon: 'today', label: 'Reservas de hoy' },
  { to: '/admin/pedidos', icon: 'local_shipping', label: 'Gestionar pedidos' },
  { to: '/admin/canchas', icon: 'add_circle', label: 'Nueva Cancha' },
  { to: '/admin/carrusel', icon: 'add_photo_alternate', label: 'Nuevo Slide' },
  { to: '/admin/productos', icon: 'add_shopping_cart', label: 'Nuevo Producto' },
  { to: '/admin/torneos', icon: 'emoji_events', label: 'Nuevo Torneo' },
  { to: '/admin/media', icon: 'upload', label: 'Subir Imagen' },
]

function Dashboard() {
  const { stats, loading, error, loadStats } = useAdmin()

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p>Bienvenido al panel de administración de PadelZone</p>
      </div>

      {error && (
        <div className="dashboard-error" role="alert">
          <i className="material-icons">error_outline</i>
          <span>{error}</span>
          <button type="button" onClick={loadStats}>Reintentar</button>
        </div>
      )}

      <div className="dashboard-stats">
        {statCards.map(card => (
          <Link to={card.to} className="stat-card" key={card.key}>
            <div className="stat-icon" style={{ backgroundColor: card.color }}>
              <i className="material-icons">{card.icon}</i>
            </div>
            <div className="stat-info">
              <span className="stat-number">
                {loading ? '...' : error ? '—' : stats[card.key]}
              </span>
              <span className="stat-label">{card.label}</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="dashboard-links">
        <h5>Acciones rápidas</h5>
        <div className="dashboard-actions">
          {quickActions.map(action => (
            <Link key={action.to} to={action.to} className="dashboard-action-btn">
              <i className="material-icons">{action.icon}</i>
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
