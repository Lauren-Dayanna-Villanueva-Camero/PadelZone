import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import multer from 'multer'
import { connectDB } from './db.js'
import { checkCloudinary, MAX_SIZE_CLOUDINARY } from './libs/cloudinary.js'
import authRoutes from './routes/auth.routes.js'
import { PORT, MONGODB_URI, JWT_SECRET, CLIENT_URL } from './config.js'

import canchasRoutes from './routes/canchas.routes.js'
import reservasRoutes from './routes/reservas.routes.js'
import productosRoutes from './routes/productos.routes.js'
import pedidosRoutes from './routes/pedidos.routes.js'
import torneoRoutes from './routes/torneos.routes.js'
import carruselRoutes from './routes/carrusel.routes.js'
import mediaRoutes from './routes/media.routes.js'
import adminRoutes from './routes/admin.routes.js'
import clasesRoutes from './routes/clases.routes.js'
import solicitudesRoutes from './routes/solicitudes.routes.js'

// Sin estas variables el servidor no puede funcionar de forma segura
if (!MONGODB_URI || !JWT_SECRET) {
  console.error('Faltan variables de entorno: MONGODB_URI y JWT_SECRET son obligatorias')
  process.exit(1)
}

const app = express()

app.use(cors({
  origin: CLIENT_URL,
  credentials: true
}))
app.use(morgan('dev'))
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())

app.use('/api/auth', authRoutes)

app.use('/api/canchas', canchasRoutes)
app.use('/api/reservas', reservasRoutes)
app.use('/api/productos', productosRoutes)
app.use('/api/pedidos', pedidosRoutes)
app.use('/api/torneos', torneoRoutes)
app.use('/api/carrusel', carruselRoutes)
app.use('/api/media', mediaRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/clases', clasesRoutes)
app.use('/api/solicitudes-torneo', solicitudesRoutes)

app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' })
})

// Manejador de errores: responde siempre JSON (errores de multer, JSON mal formado, etc.)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? `La imagen supera el tamaño máximo de ${MAX_SIZE_CLOUDINARY / 1024 / 1024}MB`
      : err.message
    return res.status(400).json({ message })
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'JSON inválido' })
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Identificador inválido' })
  }

  // Errores lanzados desde fileFilter de multer
  if (err.message?.startsWith('Solo se permiten imágenes')) {
    return res.status(400).json({ message: err.message })
  }

  console.error('Error no controlado:', err)
  return res.status(500).json({ message: 'Error interno del servidor' })
})

await connectDB()
await checkCloudinary()
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`))
