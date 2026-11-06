import axios from 'axios'

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true // para enviar cookies automáticamente
})

// Las imágenes guardadas localmente tienen una ruta relativa al backend ('/api/media/...')
const API_ORIGIN = new URL(API_URL).origin
export const mediaUrl = (url) => (url && url.startsWith('/') ? API_ORIGIN + url : url)

// Extrae un mensaje legible de un error de axios
export const getErrorMessage = (error, fallback = 'Ocurrió un error. Inténtalo de nuevo.') => {
  if (!error.response) return 'No se pudo conectar con el servidor.'
  const { message, errors } = error.response.data || {}
  if (errors?.length) return errors.join('. ')
  return message || fallback
}

// ─── AUTH ───────────────────────────────────────────
export const registerApi = (data) => api.post('/auth/register', data)
export const loginApi = (data) => api.post('/auth/login', data)
export const logoutApi = () => api.post('/auth/logout')
export const getProfileApi = () => api.get('/auth/profile')
export const updateProfileApi = (data) => api.put('/auth/profile', data)
export const forgotPasswordApi = (email) => api.post('/auth/forgot-password', { email })
export const resetPasswordApi = (token, password) => api.post('/auth/reset-password', { token, password })

// ─── ADMIN ──────────────────────────────────────────
export const getAdminStatsApi = () => api.get('/admin/stats')
export const getUsuariosApi = (q) => api.get('/admin/usuarios', { params: q ? { q } : {} })
export const updateUsuarioApi = (id, data) => api.put(`/admin/usuarios/${id}`, data)

// `todas`: incluye registros inactivos (solo funciona con sesión de admin)
const todasParam = (todas) => (todas ? { todas: 1 } : {})

// ─── CANCHAS ────────────────────────────────────────
export const getCanchasApi = (todas) => api.get('/canchas', { params: todasParam(todas) })
export const getCanchaByIdApi = (id) => api.get(`/canchas/${id}`)
export const createCanchaApi = (data) => api.post('/canchas', data)
export const updateCanchaApi = (id, data) => api.put(`/canchas/${id}`, data)
export const deleteCanchaApi = (id) => api.delete(`/canchas/${id}`)

// ─── RESERVAS ───────────────────────────────────────
export const getReservasApi = () => api.get('/reservas')
export const getHorariosOcupadosApi = (cancha_id, fecha) =>
  api.get('/reservas/ocupados', { params: { cancha_id, fecha } })
export const createReservaApi = (data) => api.post('/reservas', data)
export const cancelarReservaApi = (id) => api.put(`/reservas/${id}/cancelar`)
export const deleteReservaApi = (id) => api.delete(`/reservas/${id}`)

// ─── PRODUCTOS ──────────────────────────────────────
export const getProductosApi = (categoria, todas) =>
  api.get('/productos', { params: { ...(categoria ? { categoria } : {}), ...todasParam(todas) } })
export const getProductoByIdApi = (id) => api.get(`/productos/${id}`)
export const createProductoApi = (data) => api.post('/productos', data)
export const updateProductoApi = (id, data) => api.put(`/productos/${id}`, data)
export const deleteProductoApi = (id) => api.delete(`/productos/${id}`)

// ─── PEDIDOS ────────────────────────────────────────
export const getPedidosApi = () => api.get('/pedidos')
export const getPedidoByIdApi = (id) => api.get(`/pedidos/${id}`)
export const createPedidoApi = (data) => api.post('/pedidos', data)
export const updateEstadoPedidoApi = (id, estado) =>
  api.put(`/pedidos/${id}/estado`, { estado })
export const cancelarPedidoApi = (id) => api.put(`/pedidos/${id}/cancelar`)

// ─── TORNEOS ────────────────────────────────────────
export const getTorneosApi = () => api.get('/torneos')
export const getTorneoByIdApi = (id) => api.get(`/torneos/${id}`)
export const getMisInscripcionesApi = () => api.get('/torneos/mis-inscripciones')
export const createTorneoApi = (data) => api.post('/torneos', data)
export const updateTorneoApi = (id, data) => api.put(`/torneos/${id}`, data)
export const deleteTorneoApi = (id) => api.delete(`/torneos/${id}`)
export const inscribirTorneoApi = (id, data) => api.post(`/torneos/${id}/inscribir`, data)
export const updateParticipanteApi = (torneoId, participanteId, data) =>
  api.put(`/torneos/${torneoId}/participantes/${participanteId}`, data)
export const cancelarInscripcionApi = (id) => api.delete(`/torneos/${id}/cancelar-inscripcion`)
export const cerrarInscripcionesApi = (id) => api.put(`/torneos/${id}/cerrar-inscripciones`)
export const reorganizarTorneoApi = (id) => api.put(`/torneos/${id}/reorganizar`)
export const exportarTorneoApi = (id) => api.get(`/torneos/${id}/exportar`, { responseType: 'blob' })
// Cuadro de eliminación: solo admin y participantes. `ganador` es el número de pareja o null para quitarlo
export const getCuadroTorneoApi = (id) => api.get(`/torneos/${id}/cuadro`)
export const setGanadorPartidoApi = (torneoId, partidoId, ganador) =>
  api.put(`/torneos/${torneoId}/partidos/${partidoId}`, { ganador })
// Horarios de los partidos: los del usuario y, para el admin, ajustar o recalcular
export const getMisPartidosApi = () => api.get('/torneos/mis-partidos')
export const setHorarioPartidoApi = (torneoId, partidoId, data) =>
  api.put(`/torneos/${torneoId}/partidos/${partidoId}/horario`, data)
export const reprogramarHorariosApi = (torneoId) => api.put(`/torneos/${torneoId}/reprogramar`)

// ─── SOLICITUDES DE TORNEO (empresas) ───────────────
export const cotizarSolicitudApi = (data) => api.post('/solicitudes-torneo/cotizar', data)
export const createSolicitudApi = (data) => api.post('/solicitudes-torneo', data)
export const getMisSolicitudesApi = () => api.get('/solicitudes-torneo/mias')
export const cancelarSolicitudApi = (id) => api.put(`/solicitudes-torneo/${id}/cancelar`)
export const getSolicitudesApi = () => api.get('/solicitudes-torneo')
export const aprobarSolicitudApi = (id, respuesta) => api.put(`/solicitudes-torneo/${id}/aprobar`, { respuesta })
export const rechazarSolicitudApi = (id, respuesta) => api.put(`/solicitudes-torneo/${id}/rechazar`, { respuesta })

// ─── CLASES ─────────────────────────────────────────
export const getMisClasesApi = () => api.get('/clases/mis-inscripciones')
export const getInscripcionesClasesApi = () => api.get('/clases/inscripciones')
export const inscribirClaseApi = (data) => api.post('/clases/inscripciones', data)
export const cancelarClaseApi = (id) => api.put(`/clases/inscripciones/${id}/cancelar`)

// ─── CARRUSEL ───────────────────────────────────────
export const getCarruselApi = (todas) => api.get('/carrusel', { params: todasParam(todas) })
export const createSlideApi = (data) => api.post('/carrusel', data)
export const updateSlideApi = (id, data) => api.put(`/carrusel/${id}`, data)
export const deleteSlideApi = (id) => api.delete(`/carrusel/${id}`)

// ─── MEDIA ──────────────────────────────────────────
// axios pone el Content-Type multipart (con su boundary) automáticamente al enviar FormData
export const uploadMediaApi = (formData) => api.post('/media/upload', formData)
export const getMediaApi = (tipo) =>
  api.get('/media', { params: tipo ? { tipo } : {} })
export const deleteMediaApi = (id) => api.delete(`/media/${id}`)

export default api
