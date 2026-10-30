import cloudinaryPkg from 'cloudinary'

const cloudinary = cloudinaryPkg.v2

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env

// Límites de tamaño: Cloudinary (plan gratuito) admite hasta 10MB por imagen;
// en MongoDB se guarda el binario en el documento (máx. 16MB), se deja margen.
export const MAX_SIZE_CLOUDINARY = 10 * 1024 * 1024
export const MAX_SIZE_MONGO = 5 * 1024 * 1024

const configured = Boolean(
  CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET
)

// Si no hay credenciales o Cloudinary no responde, las imágenes se guardan en MongoDB
let enabled = configured

if (configured) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true
  })
}

export const cloudinaryEnabled = () => enabled

// Se llama al arrancar: si las credenciales fallan se usa MongoDB
export const checkCloudinary = async () => {
  if (!configured) {
    console.log('Cloudinary no configurado: las imágenes se guardan en MongoDB')
    return
  }
  try {
    await cloudinary.api.ping()
    enabled = true
    console.log('Cloudinary conectado')
  } catch (error) {
    enabled = false
    console.error('Cloudinary no disponible, se usará MongoDB:', error.error?.message || error.message)
  }
}

export const uploadBuffer = (buffer, folder) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream(
    { folder: `padelzone/${folder}`, resource_type: 'image' },
    (error, result) => (error ? reject(error) : resolve(result))
  )
  stream.end(buffer)
})

export const destroyImage = (publicId) => cloudinary.uploader.destroy(publicId)
