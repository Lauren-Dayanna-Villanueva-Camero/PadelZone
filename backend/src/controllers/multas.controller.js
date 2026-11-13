import { z } from 'zod'
import Multa from '../models/multa.model.js'
import { estadoMultas, registrarInasistencia, quitarInasistencia, anularMulta, reglasMultas } from '../libs/multas.js'

const responderError = (res, error, donde) => {
  if (error.status) return res.status(error.status).json({ message: error.message })
  console.error(`Error en ${donde}:`, error)
  return res.status(500).json({ message: 'Error interno del servidor' })
}

// GET /api/multas/mias — multas del usuario y si puede pagar reservas en la sede
export const getMisMultas = async (req, res) => {
  try {
    const [estado, historial] = await Promise.all([
      estadoMultas(req.user._id),
      Multa.find({ usuario_id: req.user._id }).sort({ createdAt: -1 }).limit(100)
    ])
    const { pendientes, ...resto } = estado
    return res.status(200).json({ ...resto, pendientes: pendientes.length, multas: historial })
  } catch (error) {
    return responderError(res, error, 'getMisMultas')
  }
}

// GET /api/multas?estado=pendiente|pagada|anulada — solo admin
export const getMultas = async (req, res) => {
  try {
    const { estado } = req.query
    const filtro = ['pendiente', 'pagada', 'anulada'].includes(estado) ? { estado } : {}
    const [multas, totales] = await Promise.all([
      Multa.find(filtro)
        .populate('usuario_id', 'nombre apellido email foto_url')
        .populate('registrada_por', 'nombre apellido')
        .sort({ createdAt: -1 })
        .limit(500),
      Multa.aggregate([{ $group: { _id: '$estado', monto: { $sum: '$monto' }, cantidad: { $sum: 1 } } }])
    ])
    const resumen = Object.fromEntries(['pendiente', 'pagada', 'anulada'].map(e => {
      const g = totales.find(t => t._id === e)
      return [e, { monto: g?.monto ?? 0, cantidad: g?.cantidad ?? 0 }]
    }))
    return res.status(200).json({ multas, resumen, reglas: reglasMultas() })
  } catch (error) {
    return responderError(res, error, 'getMultas')
  }
}

const anularSchema = z.object({
  motivo: z.string().trim().min(3, 'Explica brevemente por qué se anula').max(300, 'El motivo admite hasta 300 caracteres')
})

// PUT /api/multas/:id/anular — solo admin: perdona una multa pendiente
export const anularMultaCtrl = async (req, res) => {
  try {
    const parsed = anularSchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      return res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.issues.map(e => e.message) })
    }
    const multa = await anularMulta(req.params.id, parsed.data.motivo)
    return res.status(200).json({ message: 'Multa anulada', multa })
  } catch (error) {
    return responderError(res, error, 'anularMulta')
  }
}

// PUT /api/reservas/:id/no-asistio — solo admin
export const marcarNoAsistio = async (req, res) => {
  try {
    const { reserva, multa } = await registrarInasistencia(req.params.id, req.user._id)
    return res.status(200).json({ message: 'Inasistencia registrada y multa creada', reserva, multa })
  } catch (error) {
    return responderError(res, error, 'marcarNoAsistio')
  }
}

// DELETE /api/reservas/:id/no-asistio — solo admin: deshace la marca (y anula la multa)
export const desmarcarNoAsistio = async (req, res) => {
  try {
    const reserva = await quitarInasistencia(req.params.id)
    return res.status(200).json({ message: 'Inasistencia quitada', reserva })
  } catch (error) {
    return responderError(res, error, 'desmarcarNoAsistio')
  }
}
