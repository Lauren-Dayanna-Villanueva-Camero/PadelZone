import { useState } from 'react'
import { mediaUrl } from '../../services/api'
import './Avatar.css'

const iniciales = (persona) => {
  const texto = [persona?.nombre, persona?.apellido].filter(Boolean).join(' ').trim()
  if (!texto) return 'U'
  return texto.split(/\s+/).map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

/**
 * Foto de perfil redonda; si no hay foto (o no carga) muestra las iniciales.
 * - persona: { nombre, apellido, foto_url }
 * - size: diámetro en px
 */
function Avatar({ persona, size = 36, className = '' }) {
  const url = persona?.foto_url ? mediaUrl(persona.foto_url) : null
  // Recuerda qué URL falló; si cambia la foto se vuelve a intentar
  const [urlRota, setUrlRota] = useState(null)
  const estilo = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) }

  if (url && url !== urlRota) {
    return (
      <img
        className={`avatar ${className}`}
        style={estilo}
        src={url}
        alt=""
        onError={() => setUrlRota(url)}
      />
    )
  }
  return (
    <span className={`avatar avatar--iniciales ${className}`} style={estilo} aria-hidden="true">
      {iniciales(persona)}
    </span>
  )
}

export default Avatar
