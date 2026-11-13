// Prepara una foto de perfil en el navegador antes de subirla: la recorta al
// cuadrado del centro, la reduce a LADO×LADO y la comprime en JPEG. Así una foto
// de celular de 5MB queda en ~30-60KB y se ve igual en el círculo del avatar.

const LADO = 400
const TIPOS = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_ORIGINAL = 15 * 1024 * 1024

const cargarImagen = (archivo) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(archivo)
  const img = new Image()
  img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')) }
  img.src = url
})

export const recortarFoto = async (archivo) => {
  if (!TIPOS.includes(archivo.type)) throw new Error('Elige una imagen JPG, PNG o WEBP')
  if (archivo.size > MAX_ORIGINAL) throw new Error('La imagen es muy pesada (máximo 15MB)')

  const img = await cargarImagen(archivo)
  const lado = Math.min(img.naturalWidth, img.naturalHeight)
  if (!lado) throw new Error('No se pudo leer la imagen')
  const sx = (img.naturalWidth - lado) / 2
  const sy = (img.naturalHeight - lado) / 2
  const destino = Math.min(LADO, lado)

  const canvas = document.createElement('canvas')
  canvas.width = destino
  canvas.height = destino
  const ctx = canvas.getContext('2d')
  // Fondo blanco: los PNG con transparencia no quedan negros al pasar a JPEG
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, destino, destino)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, lado, lado, 0, 0, destino, destino)

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88))
  if (!blob) throw new Error('No se pudo procesar la imagen')
  return blob
}
