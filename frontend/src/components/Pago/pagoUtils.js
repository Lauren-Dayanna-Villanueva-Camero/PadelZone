import { getPagosConfigApi } from '../../services/api'

// Configuración de pagos del backend (se pide una sola vez)
let configPromise = null
export const cargarConfigPagos = () => {
  if (!configPromise) {
    configPromise = getPagosConfigApi()
      .then(res => res.data)
      .catch(err => {
        configPromise = null
        throw err
      })
  }
  return configPromise
}

export const CONCEPTOS = {
  reserva: { label: 'Reserva', icon: 'event_available' },
  pedido: { label: 'Tienda', icon: 'shopping_bag' },
  torneo: { label: 'Torneo', icon: 'emoji_events' },
  clase: { label: 'Clase', icon: 'school' }
}

export const ESTADOS_PAGO = {
  pendiente: { label: 'Pendiente', icon: 'schedule' },
  aprobado: { label: 'Aprobado', icon: 'check_circle' },
  rechazado: { label: 'Rechazado', icon: 'cancel' },
  anulado: { label: 'Anulado', icon: 'block' }
}

// "VISA •••• 4242", "PSE · Bancolombia", "Nequi ******4567", "Efectivo"
export const textoMetodo = (pago) => {
  const d = pago?.detalle ?? {}
  switch (pago?.metodo) {
    case 'tarjeta': return d.ultimos4 ? `${d.marca ?? 'Tarjeta'} •••• ${d.ultimos4}` : 'Tarjeta'
    case 'pse': return d.banco ? `PSE · ${d.banco}` : 'PSE'
    case 'nequi': return d.telefono ? `Nequi ${d.telefono}` : 'Nequi'
    case 'efectivo': return 'Efectivo (en la sede)'
    default: return 'En línea'
  }
}

export const formatFechaHora = (valor) => valor
  ? new Date(valor).toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  : '—'

// Al volver de Wompi se regresa a la página desde donde se pagó
const CLAVE_RETORNO = 'padelzone:pago-retorno'
export const guardarRetornoPago = (datos) => sessionStorage.setItem(CLAVE_RETORNO, JSON.stringify(datos))
export const leerRetornoPago = () => {
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE_RETORNO)) ?? null
  } catch {
    return null
  }
}
