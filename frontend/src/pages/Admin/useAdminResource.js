import { useState, useEffect, useCallback } from 'react'
import { getErrorMessage } from '../../services/api'

// Carga una lista desde la API para una página de gestión.
// `fetcher` debe ser estable (función de módulo o useCallback) y devolver una respuesta de axios.
export const useAdminResource = (fetcher) => {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (isCancelled = () => false) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetcher()
      if (!isCancelled()) setItems(res.data)
    } catch (err) {
      if (!isCancelled()) setError(getErrorMessage(err, 'No se pudieron cargar los datos'))
    } finally {
      if (!isCancelled()) setLoading(false)
    }
  }, [fetcher])

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos al montar
    load(() => cancelled)
    return () => { cancelled = true }
  }, [load])

  const reload = useCallback(() => load(), [load])

  return { items, setItems, loading, error, reload }
}
