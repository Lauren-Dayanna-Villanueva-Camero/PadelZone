import { Suspense } from 'react'
import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { AdminProvider } from '../../contexts/AdminContext'
import AdminSidebar from './components/AdminSidebar'

import './Admin.css'

// Este guard solo controla la interfaz: la protección real está en el backend
// (authRequired + adminRequired leen el rol desde la base de datos).
function Admin() {
  const { isAuthenticated, isAdmin, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="admin-loading">
        <i className="material-icons spinning">refresh</i>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return (
    <AdminProvider>
      <div className="admin-layout">
        <AdminSidebar />
        <main className="admin-main">
          {/* Suspense propio: al cambiar de sección no desaparece el sidebar */}
          <Suspense fallback={<div className="admin-loading"><i className="material-icons spinning">refresh</i></div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </AdminProvider>
  )
}

export default Admin
