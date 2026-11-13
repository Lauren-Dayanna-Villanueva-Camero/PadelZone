import { useState, useEffect, useCallback, useMemo } from 'react'
import { AuthContext } from './contexts'
import api, {
  loginApi,
  googleLoginApi,
  registerApi,
  logoutApi,
  getProfileApi,
  updateProfileApi
} from '../services/api'

// Unifica la forma del usuario: login/register devuelven `id`, profile devuelve `_id`
const normalizeUser = (u) => u && ({
  id: u.id || u._id,
  nombre: u.nombre,
  apellido: u.apellido,
  email: u.email,
  telefono: u.telefono,
  rol: u.rol,
  // false en cuentas creadas con Google que aún no eligieron contraseña
  tiene_password: u.tiene_password ?? true,
  google: Boolean(u.google)
})

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Recupera la sesión a partir de la cookie httpOnly
  useEffect(() => {
    let cancelled = false

    // Limpia la sesión simulada que guardaba la versión anterior
    try { localStorage.removeItem('padelzone_user') } catch { /* sin acceso a storage */ }

    getProfileApi()
      .then(res => { if (!cancelled) setUser(normalizeUser(res.data)) })
      .catch(() => { if (!cancelled) setUser(null) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [])

  // Si el backend responde 401 (token expirado o inválido), se cierra la sesión local
  useEffect(() => {
    const id = api.interceptors.response.use(
      res => res,
      error => {
        if (error.response?.status === 401) setUser(null)
        return Promise.reject(error)
      }
    )
    return () => api.interceptors.response.eject(id)
  }, [])

  const login = useCallback(async (credentials) => {
    const res = await loginApi(credentials)
    const loggedUser = normalizeUser(res.data.user)
    setUser(loggedUser)
    return loggedUser
  }, [])

  // Inicia sesión (o crea la cuenta) con el ID token del botón de Google
  const loginWithGoogle = useCallback(async (credential) => {
    const res = await googleLoginApi(credential)
    const loggedUser = normalizeUser(res.data.user)
    setUser(loggedUser)
    return loggedUser
  }, [])

  const register = useCallback(async (data) => {
    const res = await registerApi(data)
    const newUser = normalizeUser(res.data.user)
    setUser(newUser)
    return newUser
  }, [])

  const logout = useCallback(async () => {
    try {
      await logoutApi()
    } finally {
      setUser(null)
    }
  }, [])

  const updateProfile = useCallback(async (data) => {
    const res = await updateProfileApi(data)
    const updated = normalizeUser(res.data.user)
    setUser(updated)
    return updated
  }, [])

  const value = useMemo(() => ({
    user,
    login,
    loginWithGoogle,
    register,
    logout,
    updateProfile,
    isAuthenticated: !!user,
    isAdmin: user?.rol === 'admin',
    loading
  }), [user, login, loginWithGoogle, register, logout, updateProfile, loading])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
