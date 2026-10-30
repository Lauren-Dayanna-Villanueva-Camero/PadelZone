import { useState, useEffect, useCallback, useMemo } from 'react'
import { AdminContext } from './contexts'
import { getAdminStatsApi, getErrorMessage } from '../services/api'

const initialStats = {
  canchas: 0,
  reservas: 0,
  productos: 0,
  torneos: 0,
  media: 0,
  usuarios: 0,
  pedidos: 0
}

export const AdminProvider = ({ children }) => {
  const [stats, setStats] = useState(initialStats)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Un solo endpoint con countDocuments: no descarga colecciones completas
  const fetchStats = useCallback(async (isCancelled = () => false) => {
    setLoading(true)
    setError('')
    try {
      const res = await getAdminStatsApi()
      if (!isCancelled()) setStats(res.data)
    } catch (err) {
      if (!isCancelled()) setError(getErrorMessage(err, 'No se pudieron cargar las estadísticas'))
    } finally {
      if (!isCancelled()) setLoading(false)
    }
  }, [])

  // Carga inicial
  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos al montar
    fetchStats(() => cancelled)
    return () => { cancelled = true }
  }, [fetchStats])

  // Permite actualizar las estadísticas manualmente
  const loadStats = useCallback(() => fetchStats(), [fetchStats])

  const value = useMemo(
    () => ({ stats, loading, error, loadStats }),
    [stats, loading, error, loadStats]
  )

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  )
}
