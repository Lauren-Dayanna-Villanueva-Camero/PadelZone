import { useState, useEffect } from 'react'
import { getCanchasApi, getErrorMessage } from '../services/api'

// Canchas activas del backend, con estados de carga y error
export const useCanchas = () => {
  const [canchas, setCanchas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getCanchasApi()
      .then(res => { if (!cancelled) setCanchas(res.data) })
      .catch(err => { if (!cancelled) setError(getErrorMessage(err, 'No se pudieron cargar las canchas')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return { canchas, loading, error }
}
