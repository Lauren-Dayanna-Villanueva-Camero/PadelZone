import crypto from 'node:crypto'

// Sin 0/O ni 1/I/L para que el código se pueda dictar o copiar a mano sin errores
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

// Código de acceso de un torneo privado: 8 caracteres, p. ej. 'K7QM-3XRA'
export const generarCodigo = () => {
  let codigo = ''
  for (let i = 0; i < 8; i++) codigo += ALFABETO[crypto.randomInt(ALFABETO.length)]
  return `${codigo.slice(0, 4)}-${codigo.slice(4)}`
}

// Se compara sin guion, sin espacios y sin distinguir mayúsculas
const normalizar = (codigo) => String(codigo ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

export const codigoValido = (ingresado, guardado) => {
  const a = Buffer.from(normalizar(ingresado))
  const b = Buffer.from(normalizar(guardado))
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b)
}
