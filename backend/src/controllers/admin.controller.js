import { z } from 'zod'
import Cancha from '../models/cancha.model.js'
import Reserva from '../models/reserva.model.js'
import Producto from '../models/producto.model.js'
import Torneo from '../models/torneo.model.js'
import Media from '../models/media.model.js'
import User from '../models/user.model.js'
import Pedido from '../models/pedido.model.js'
import { finalizarTorneosVencidos } from '../libs/torneos.js'

// GET /api/admin/stats — solo admin
// Usa countDocuments para no descargar colecciones completas
export const getStats = async (req, res) => {
  try {
    await finalizarTorneosVencidos()
    const [canchas, reservas, productos, torneos, media, usuarios, pedidos] = await Promise.all([
      Cancha.countDocuments({ activa: true }),
      Reserva.countDocuments({ estado: { $ne: 'cancelada' } }),
      Producto.countDocuments({ activo: true }),
      Torneo.countDocuments({ estado: { $in: ['activo', 'en_curso'] } }),
      Media.countDocuments(),
      User.countDocuments({ activo: true }),
      Pedido.countDocuments({ estado: 'pendiente' })
    ])

    return res.status(200).json({ canchas, reservas, productos, torneos, media, usuarios, pedidos })
  } catch (error) {
    console.error('Error en getStats:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// GET /api/admin/usuarios?q=texto — solo admin
export const getUsuarios = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim()
    // Se escapan los caracteres especiales para que la búsqueda sea literal
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const filter = q
      ? { $or: ['nombre', 'apellido', 'email'].map(f => ({ [f]: { $regex: safe, $options: 'i' } })) }
      : {}

    const usuarios = await User.find(filter)
      .select('-password_hash -reset_token_hash -reset_token_expira')
      .sort({ fecha_registro: -1 })

    return res.status(200).json(usuarios)
  } catch (error) {
    console.error('Error en getUsuarios:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

const usuarioUpdateSchema = z.object({
  rol: z.enum(['usuario', 'admin', 'profesor'], { error: 'Rol inválido' }).optional(),
  activo: z.boolean().optional()
}).strict()

// PUT /api/admin/usuarios/:id — solo admin: cambia rol o activa/desactiva
export const updateUsuario = async (req, res) => {
  try {
    const parsed = usuarioUpdateSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Datos inválidos',
        errors: parsed.error.issues.map(e => e.message)
      })
    }

    // Evita que un admin se quite el acceso a sí mismo por error
    const esMismo = req.params.id === req.user._id.toString()
    if (esMismo && (parsed.data.activo === false || (parsed.data.rol && parsed.data.rol !== 'admin'))) {
      return res.status(400).json({ message: 'No puedes quitarte el rol de admin ni desactivar tu propia cuenta' })
    }

    const usuario = await User.findByIdAndUpdate(
      req.params.id,
      parsed.data,
      { new: true, runValidators: true }
    ).select('-password_hash -reset_token_hash -reset_token_expira')

    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' })
    }

    return res.status(200).json({ message: 'Usuario actualizado', usuario })
  } catch (error) {
    console.error('Error en updateUsuario:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}
