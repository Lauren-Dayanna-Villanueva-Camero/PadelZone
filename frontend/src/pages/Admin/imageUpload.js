import { uploadMediaApi } from '../../services/api'

// Tope de Cloudinary; si el backend guarda en MongoDB aplica uno menor y responde el error
const MAX_SIZE = 10 * 1024 * 1024
export const ACCEPT_IMAGES = 'image/jpeg,image/png,image/webp'

// Valida tamaño y tipo antes de subir (el backend vuelve a comprobarlo)
export const validateImageFile = (file) => {
  if (!ACCEPT_IMAGES.split(',').includes(file.type)) return 'Solo se permiten imágenes JPG, PNG o WEBP'
  if (file.size > MAX_SIZE) return 'La imagen supera el tamaño máximo de 10MB'
  return ''
}

export const uploadImage = async (file, tipo) => {
  const formData = new FormData()
  formData.append('imagen', file)
  formData.append('tipo', tipo)
  const res = await uploadMediaApi(formData)
  return res.data.media
}
