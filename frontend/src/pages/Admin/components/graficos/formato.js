import { useEffect, useState } from 'react'

// Formatos y utilidades compartidas por los gráficos del dashboard

// ─── Formatos ───────────────────────────────────────

const numero = new Intl.NumberFormat('es-CO')
const compacto = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 })

export const fmtCOP = (n) => `$${numero.format(Math.round(n))}`
export const fmtCOPCorto = (n) => `$${compacto.format(n)}`
export const fmtNumero = (n) => numero.format(n)
export const fmtPct = (n) => `${numero.format(Math.round(n * 10) / 10)} %`

// '2026-11-12' → '12 nov'
export const fmtDia = (key, opciones = { day: 'numeric', month: 'short' }) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString('es-CO', { ...opciones, timeZone: 'UTC' }).replace('.', '')

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

// Ancho del contenedor (los gráficos se adaptan al espacio disponible)
export function useAncho(ref) {
  const [ancho, setAncho] = useState(0)
  useEffect(() => {
    if (!ref.current) return undefined
    const obs = new ResizeObserver(([entrada]) => setAncho(Math.floor(entrada.contentRect.width)))
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [ref])
  return ancho
}
