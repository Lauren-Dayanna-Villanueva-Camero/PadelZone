import 'bootstrap/dist/css/bootstrap.min.css'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar/Navbar'
import Footer from './components/Footer/Footer'
import Home from './pages/Home/Home'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './hooks/useAuth'

// Carga diferida: cada página se descarga solo cuando se visita
const Reservations = lazy(() => import('./pages/Reservations/Reservations'))
const Login = lazy(() => import('./pages/Login/Login'))
const Register = lazy(() => import('./pages/Register/Register'))
const ResetPassword = lazy(() => import('./pages/ResetPassword/ResetPassword'))
const Courts = lazy(() => import('./pages/Courts/Courts'))
const Contact = lazy(() => import('./pages/Contact/Contact'))
const Profile = lazy(() => import('./pages/Profile/Profile'))
const Tournaments = lazy(() => import('./pages/Tournaments/Tournaments'))
const Clases = lazy(() => import('./pages/clases/clases'))
const Tienda = lazy(() => import('./pages/Tienda/Tienda'))
const Weather = lazy(() => import('./pages/Weather/Weather'))

const Admin = lazy(() => import('./pages/Admin/Admin'))
const Dashboard = lazy(() => import('./pages/Admin/sections/Dashboard'))
const AdminReservas = lazy(() => import('./pages/Admin/sections/Reservas'))
const AdminPedidos = lazy(() => import('./pages/Admin/sections/Pedidos'))
const AdminCanchas = lazy(() => import('./pages/Admin/sections/Canchas'))
const AdminProductos = lazy(() => import('./pages/Admin/sections/Productos'))
const AdminTorneos = lazy(() => import('./pages/Admin/sections/Torneos'))
const AdminCarrusel = lazy(() => import('./pages/Admin/sections/Carrusel'))
const AdminMedia = lazy(() => import('./pages/Admin/sections/Media'))
const AdminUsuarios = lazy(() => import('./pages/Admin/sections/Usuarios'))

const LoadingScreen = () => (
  <div className="loading-screen" style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '50vh'
  }}>
    <i className="material-icons spinning" style={{ fontSize: '48px', color: '#1e3c72' }}>
      refresh
    </i>
  </div>
)

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen />

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}

// Login y registro: si ya hay sesión, redirige a donde el usuario quería ir.
// Login/Register no navegan por su cuenta; esta redirección ocurre al actualizarse `user`.
const PublicRoute = ({ children }) => {
  const { isAuthenticated, isAdmin, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen />

  if (isAuthenticated) {
    const from = location.state?.from
    const fallback = isAdmin ? '/admin' : '/reservar'
    // `from` puede ser un objeto location (ProtectedRoute) o un string (clases)
    const to = typeof from === 'string' ? from : from?.pathname ? from : fallback
    return <Navigate to={to} state={location.state} replace />
  }

  return children
}

// El panel de admin tiene su propio layout: sin la barra ni el pie del sitio
function SiteLayout({ children }) {
  const { pathname } = useLocation()
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/')

  return (
    <>
      {!isAdmin && <Navbar />}
      {children}
      {!isAdmin && <Footer />}
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SiteLayout>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route
                path="/reservar"
                element={
                  <ProtectedRoute>
                    <Reservations />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                }
              />
              <Route
                path="/registro"
                element={
                  <PublicRoute>
                    <Register />
                  </PublicRoute>
                }
              />
              <Route path="/restablecer/:token" element={<ResetPassword />} />
              <Route path="/canchas" element={<Courts />} />
              <Route path="/contacto" element={<Contact />} />
              <Route
                path="/perfil"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />

              <Route path="/torneos" element={<Tournaments />} />
              <Route path="/clases" element={<Clases />} />
              <Route path="/tiendas" element={<Tienda />} />
              <Route path="/clima" element={<Weather />} />

              <Route path="/admin" element={<Admin />}>
                <Route index element={<Dashboard />} />
                <Route path="reservas" element={<AdminReservas />} />
                <Route path="pedidos" element={<AdminPedidos />} />
                <Route path="canchas" element={<AdminCanchas />} />
                <Route path="productos" element={<AdminProductos />} />
                <Route path="torneos" element={<AdminTorneos />} />
                <Route path="carrusel" element={<AdminCarrusel />} />
                <Route path="media" element={<AdminMedia />} />
                <Route path="usuarios" element={<AdminUsuarios />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </SiteLayout>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
