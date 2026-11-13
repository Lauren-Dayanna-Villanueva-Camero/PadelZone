// Valor mensual de cada grupo de clases (COP). El catálogo que se muestra vive en
// el frontend (pages/clases); esta tabla es la que manda al cobrar, para que el
// precio no lo pueda cambiar el cliente. Si cambias un precio, cámbialo en ambos.
export const PRECIOS_CLASES = {
  1: { '10 - 14 años': 180000, '15 - 21 años': 200000, '22 años en adelante': 220000 },
  2: { '10 - 14 años': 280000, '15 - 21 años': 320000, '22 años en adelante': 350000 },
  3: { '10 - 14 años': 150000, '15 - 21 años': 170000, '22 años en adelante': 190000 },
  4: { '10 - 14 años': 160000, '15 - 21 años': 180000, '22 años en adelante': 200000 }
}

export const precioClase = (claseId, grupo) => PRECIOS_CLASES[claseId]?.[grupo] ?? null

// Horas que dura cada clase (igual que `duracionClase` del catálogo del frontend)
export const DURACION_CLASES = { 1: 2, 2: 2, 3: 2, 4: 4 }

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
const sinTildes = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// 'Lunes, Miércoles y Viernes' → [1, 3, 5]; 'Lunes a Sábado' → [1..6]
export const diasDeClase = (texto = '') => {
  const t = sinTildes(texto)
  const rango = t.match(/(\w+) a (\w+)/)
  if (rango && DIAS.includes(rango[1]) && DIAS.includes(rango[2])) {
    const dias = []
    for (let d = DIAS.indexOf(rango[1]); ; d = (d + 1) % 7) {
      dias.push(d)
      if (d === DIAS.indexOf(rango[2])) break
    }
    return dias
  }
  const palabras = t.split(/[^a-z]+/)
  return DIAS.map((d, i) => (palabras.includes(d) ? i : null)).filter(d => d != null)
}

// '4:00 PM' → '16:00' (null si no se entiende)
export const horaDeClase = (texto = '') => {
  const m = String(texto).trim().match(/^(\d{1,2}):(\d{2})\s*([AP])\.?\s*M\.?$/i)
  if (!m) return null
  let h = Number(m[1]) % 12
  if (m[3].toUpperCase() === 'P') h += 12
  return `${String(h).padStart(2, '0')}:${m[2]}`
}
