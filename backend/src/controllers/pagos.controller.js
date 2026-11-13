import Pago from '../models/pago.model.js'
import Reserva from '../models/reserva.model.js'
import Pedido from '../models/pedido.model.js'
import Participante from '../models/participante.model.js'
import InscripcionClase from '../models/inscripcionClase.model.js'
import { iniciarPagoSchema, simularPagoSchema, anularPagoSchema } from '../schema/pago.schema.js'
import {
  BANCOS_PSE,
  MINUTOS_PARA_PAGAR,
  proveedorEnLinea,
  wompiActivo,
  iniciarPago,
  simular,
  cambiarEstado,
  consultarTransaccionWompi,
  procesarTransaccionWompi,
  eventoWompiValido
} from '../libs/pagos.js'
import { WOMPI_PUBLIC_KEY } from '../config.js'

const datosInvalidos = (res, parsed) => res.status(400).json({
  message: 'Datos inválidos',
  errors: parsed.error.issues.map(e => e.message)
})

const responderError = (res, error, donde) => {
  if (error.status) return res.status(error.status).json({ message: error.message })
  console.error(`Error en ${donde}:`, error)
  return res.status(500).json({ message: 'Error interno del servidor' })
}

const esDueno = (pago, user) => user.rol === 'admin' || String(pago.usuario_id?._id ?? pago.usuario_id) === String(user._id)

// GET /api/pagos/config — público: cómo se cobra (para armar el formulario de pago)
export const getConfig = (req, res) => {
  res.status(200).json({
    proveedor: proveedorEnLinea(),
    sandbox: wompiActivo() ? !WOMPI_PUBLIC_KEY.startsWith('pub_prod_') : true,
    bancos_pse: BANCOS_PSE,
    minutos_para_pagar: MINUTOS_PARA_PAGAR
  })
}

// POST /api/pagos — inicia el pago de una reserva, pedido, inscripción a torneo o clase
export const crearPago = async (req, res) => {
  try {
    const parsed = iniciarPagoSchema.safeParse(req.body ?? {})
    if (!parsed.success) return datosInvalidos(res, parsed)

    const { pago, checkout_url } = await iniciarPago(parsed.data, req.user)
    return res.status(201).json({
      message: pago.metodo === 'efectivo'
        ? 'Listo: paga en la sede (o al recibir tu pedido). Te confirmaremos cuando lo recibamos.'
        : 'Pago creado',
      pago,
      ...(checkout_url && { checkout_url })
    })
  } catch (error) {
    return responderError(res, error, 'crearPago')
  }
}

// POST /api/pagos/:id/simular — completa un pago simulado (solo sin llaves de Wompi)
export const simularPago = async (req, res) => {
  try {
    if (wompiActivo()) {
      return res.status(400).json({ message: 'Los pagos se hacen en la pasarela de Wompi' })
    }
    const parsed = simularPagoSchema.safeParse(req.body ?? {})
    if (!parsed.success) return datosInvalidos(res, parsed)

    const pago = await Pago.findOne({ _id: req.params.id, usuario_id: req.user._id, proveedor: 'simulado' })
    if (!pago) return res.status(404).json({ message: 'Pago no encontrado' })
    if (pago.estado !== 'pendiente') {
      return res.status(400).json({ message: 'Este pago ya fue procesado; inicia uno nuevo' })
    }

    const { estado, extra } = simular(parsed.data)
    const actualizado = await cambiarEstado(pago, estado, extra)
    return res.status(200).json({
      message: actualizado.estado === 'aprobado' ? 'Pago aprobado' : actualizado.mensaje || 'Pago rechazado',
      pago: actualizado
    })
  } catch (error) {
    return responderError(res, error, 'simularPago')
  }
}

// GET /api/pagos/wompi/verificar?id=<transacción> — al volver de la pasarela,
// se consulta la transacción en Wompi (no se confía en lo que diga la URL)
export const verificarWompi = async (req, res) => {
  try {
    if (!wompiActivo()) return res.status(400).json({ message: 'Wompi no está configurado' })
    const id = String(req.query.id ?? '')
    if (!/^[\w-]{3,64}$/.test(id)) return res.status(400).json({ message: 'Transacción inválida' })

    const tx = await consultarTransaccionWompi(id)
    const existente = await Pago.findOne({ referencia: tx?.reference, proveedor: 'wompi' })
    if (!existente || !esDueno(existente, req.user)) {
      return res.status(404).json({ message: 'Pago no encontrado' })
    }
    const pago = await procesarTransaccionWompi(tx)
    return res.status(200).json({ pago })
  } catch (error) {
    return responderError(res, error, 'verificarWompi')
  }
}

// POST /api/pagos/wompi/eventos — webhook de Wompi (URL de eventos en su panel)
export const webhookWompi = async (req, res) => {
  try {
    if (!eventoWompiValido(req.body)) {
      return res.status(401).json({ message: 'Firma inválida' })
    }
    if (req.body.event === 'transaction.updated') {
      await procesarTransaccionWompi(req.body.data?.transaction)
    }
    return res.status(200).json({ ok: true })
  } catch (error) {
    return responderError(res, error, 'webhookWompi')
  }
}

// GET /api/pagos/mios — historial de pagos del usuario (comprobantes)
export const getMisPagos = async (req, res) => {
  try {
    const pagos = await Pago.find({ usuario_id: req.user._id }).sort({ createdAt: -1 }).limit(200)
    return res.status(200).json(pagos)
  } catch (error) {
    return responderError(res, error, 'getMisPagos')
  }
}

// GET /api/pagos/:id — comprobante (dueño o admin)
export const getPagoById = async (req, res) => {
  try {
    const pago = await Pago.findById(req.params.id).populate('usuario_id', 'nombre apellido email')
    if (!pago || !esDueno(pago, req.user)) return res.status(404).json({ message: 'Pago no encontrado' })
    return res.status(200).json(pago)
  } catch (error) {
    return responderError(res, error, 'getPagoById')
  }
}

// Ids (de un concepto) cuyo registro está cancelado o ya no existe
const idsCancelados = async (concepto, ids) => {
  if (!ids.length) return new Set()
  const existentes = new Map()
  if (concepto === 'reserva') {
    for (const r of await Reserva.find({ _id: { $in: ids } }).select('estado')) existentes.set(String(r._id), r.estado === 'cancelada')
  } else if (concepto === 'pedido') {
    for (const p of await Pedido.find({ _id: { $in: ids } }).select('estado')) existentes.set(String(p._id), p.estado === 'cancelado')
  } else if (concepto === 'clase') {
    for (const c of await InscripcionClase.find({ _id: { $in: ids } }).select('estado')) existentes.set(String(c._id), c.estado === 'cancelada')
  } else {
    const parts = await Participante.find({ _id: { $in: ids } }).populate('torneo_id', 'estado').select('torneo_id')
    for (const p of parts) existentes.set(String(p._id), !p.torneo_id || p.torneo_id.estado === 'cancelado')
  }
  return new Set(ids.map(String).filter(id => !existentes.has(id) || existentes.get(id)))
}

// GET /api/pagos — solo admin. Filtros: estado, concepto, metodo, desde, hasta (YYYY-MM-DD), q (referencia)
export const getPagos = async (req, res) => {
  try {
    const { estado, concepto, metodo, desde, hasta, q } = req.query
    const filtro = {}
    if (['pendiente', 'aprobado', 'rechazado', 'anulado'].includes(estado)) filtro.estado = estado
    if (['reserva', 'pedido', 'torneo', 'clase'].includes(concepto)) filtro.concepto = concepto
    if (['tarjeta', 'pse', 'nequi', 'efectivo', 'otro'].includes(metodo)) filtro.metodo = metodo
    const esDia = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v ?? '')
    if (esDia(desde) || esDia(hasta)) {
      filtro.createdAt = {}
      // Días de Colombia (UTC-5)
      if (esDia(desde)) filtro.createdAt.$gte = new Date(`${desde}T00:00:00-05:00`)
      if (esDia(hasta)) filtro.createdAt.$lte = new Date(`${hasta}T23:59:59.999-05:00`)
    }
    if (typeof q === 'string' && q.trim()) {
      filtro.referencia = { $regex: q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
    }

    const pagos = await Pago.find(filtro)
      .populate('usuario_id', 'nombre apellido email')
      .populate('registrado_por', 'nombre apellido')
      .sort({ createdAt: -1 })
      .limit(500)

    // Pagos aprobados de algo que se canceló: hay que devolver el dinero
    const aprobados = pagos.filter(p => p.estado === 'aprobado')
    const cancelados = new Set()
    for (const c of ['reserva', 'pedido', 'torneo', 'clase']) {
      const ids = aprobados.filter(p => p.concepto === c).map(p => p.referencia_id)
      for (const id of await idsCancelados(c, ids)) cancelados.add(`${c}:${id}`)
    }

    const lista = pagos.map(p => ({
      ...p.toObject(),
      requiere_reembolso: p.estado === 'aprobado' && cancelados.has(`${p.concepto}:${p.referencia_id}`)
    }))

    const suma = (arr) => arr.reduce((acc, p) => acc + p.monto, 0)
    const porMetodo = {}
    for (const p of aprobados) porMetodo[p.metodo] = (porMetodo[p.metodo] ?? 0) + p.monto
    const pendientesEfectivo = pagos.filter(p => p.estado === 'pendiente' && p.proveedor === 'manual')

    return res.status(200).json({
      pagos: lista,
      resumen: {
        total_aprobado: suma(aprobados),
        cantidad_aprobados: aprobados.length,
        pendientes_efectivo: pendientesEfectivo.length,
        monto_pendiente_efectivo: suma(pendientesEfectivo),
        por_reembolsar: lista.filter(p => p.requiere_reembolso).length,
        por_metodo: porMetodo
      }
    })
  } catch (error) {
    return responderError(res, error, 'getPagos')
  }
}

// PUT /api/pagos/:id/confirmar — solo admin: recibió el pago en efectivo
export const confirmarPago = async (req, res) => {
  try {
    const pago = await Pago.findById(req.params.id)
    if (!pago) return res.status(404).json({ message: 'Pago no encontrado' })
    if (pago.estado !== 'pendiente' || pago.proveedor !== 'manual') {
      return res.status(400).json({ message: 'Solo se confirman a mano los pagos en efectivo pendientes' })
    }
    const actualizado = await cambiarEstado(pago, 'aprobado', { registrado_por: req.user._id })
    if (actualizado.estado !== 'aprobado') {
      return res.status(409).json({ message: 'El pago ya cambió de estado, recarga la página' })
    }
    return res.status(200).json({ message: 'Pago confirmado', pago: actualizado })
  } catch (error) {
    return responderError(res, error, 'confirmarPago')
  }
}

// PUT /api/pagos/:id/anular — solo admin: anula un pago pendiente o registra la
// devolución de uno aprobado (el reembolso en Wompi se hace desde su panel)
export const anularPago = async (req, res) => {
  try {
    const parsed = anularPagoSchema.safeParse(req.body ?? {})
    if (!parsed.success) return datosInvalidos(res, parsed)

    const pago = await Pago.findById(req.params.id)
    if (!pago) return res.status(404).json({ message: 'Pago no encontrado' })
    if (!['pendiente', 'aprobado'].includes(pago.estado)) {
      return res.status(400).json({ message: 'Solo se anulan pagos pendientes o aprobados' })
    }
    const actualizado = await cambiarEstado(pago, 'anulado', {
      mensaje: parsed.data.motivo,
      registrado_por: req.user._id
    })
    return res.status(200).json({ message: 'Pago anulado', pago: actualizado })
  } catch (error) {
    return responderError(res, error, 'anularPago')
  }
}
