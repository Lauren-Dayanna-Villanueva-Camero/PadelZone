// Imágenes locales de respaldo para registros del backend que aún no tienen imagen asociada
import { mediaUrl } from '../services/api'
import c1 from '../img/Cancha1.jpg'
import c2 from '../img/Cancha2.jpg'
import c3 from '../img/Cancha3.jpg'
import c4 from '../img/Cancha4.jpg'
import c5 from '../img/Cancha5.jpg'
import imgPala from '../img/adidas-pala-de-padel-cross-it-light-3.4-2025_1.webp'
import imgCamiseta from '../img/camisa dry fit.jpg'
import imgGrip from '../img/grip antidezlizante.jpg'
import imgPaletero from '../img/paletero pro.webp'
import t1 from '../img/Torneo1.png'
import t2 from '../img/Torneo2.png'
import t3 from '../img/Torneo3.png'

const courtFallbacks = [c1, c2, c3, c4, c5]

// Elige siempre la misma imagen para un mismo id
const pickById = (list, id = '') => {
  let hash = 0
  for (const ch of String(id)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return list[hash % list.length]
}

export const getCourtImage = (cancha) =>
  mediaUrl(cancha?.imagen_id?.url) || pickById(courtFallbacks, cancha?._id)

export const getCourtTypeIcon = (cancha) => (cancha?.tipo === 'Interior' ? 'home' : 'wb_sunny')

// El modelo no tiene descripción: se arma una a partir del tipo y si es techada
export const getCourtDescription = (cancha) =>
  `Cancha ${String(cancha?.tipo || '').toLowerCase()}${cancha?.techada ? ' techada' : ''} para partidos de 4 jugadores`

const productFallbacks = {
  pala: imgPala,
  ropa: imgCamiseta,
  accesorios: imgGrip,
  calzado: imgPaletero
}

export const getProductImage = (producto) =>
  mediaUrl(producto?.imagen_id?.url) || productFallbacks[producto?.categoria] || imgPaletero

const tournamentFallbacks = {
  Profesional: t1,
  Amateur: t2,
  Comunidad: t3
}

export const getTournamentImage = (torneo) =>
  tournamentFallbacks[torneo?.tipo_torneo] || t1

// Las fechas se guardan como medianoche UTC: se toma la parte YYYY-MM-DD
// para que no se muestre el día anterior en zonas horarias negativas (Colombia)
export const toDateKey = (value) => (value ? String(value).slice(0, 10) : '')

export const formatDateLong = (value) => {
  const key = toDateKey(value)
  if (!key) return '—'
  return new Date(key + 'T00:00:00').toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

export const formatPrice = (p) => `$${(p || 0).toLocaleString('es-CO')}`

export const todayKey = () => {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
