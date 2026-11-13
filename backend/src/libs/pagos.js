import crypto from 'node:crypto'
import Pago from '../models/pago.model.js'
import Reserva from '../models/reserva.model.js'
import Pedido from '../models/pedido.model.js'
import Participante from '../models/participante.model.js'
import InscripcionClase from '../models/inscripcionClase.model.js'
import { WOMPI_PUBLIC_KEY, WOMPI_INTEGRITY_SECRET, WOMPI_EVENTS_SECRET, CLIENT_URL } from '../config.js'
import { bloqueosDeTorneos, diaKey } from './horarios.js'
import { precioClase } from './clases.js'

// Pagos de PadelZone. Con las llaves de Wompi configuradas se cobra de verdad
// (Web Checkout de Wompi: tarjeta, PSE, Nequi...); sin ellas los pagos en línea
// son simulados con las mismas reglas que el sandbox de Wompi, para desarrollo y demos.
// "Efectivo" (pagar en la sede o contraentrega) queda pendiente hasta que el admin lo confirma.

export const MINUTOS_PARA_PAGAR = 15
export const CONCEPTOS = ['reserva', 'pedido', 'torneo', 'clase']
export const METODOS_EN_LINEA = ['tarjeta', 'pse', 'nequi']

// Bancos del PSE simulado: los dos primeros imitan los del sandbox de Wompi
export const BANCOS_PSE = [
  'Banco que aprueba', 'Banco que rechaza', 'Bancolombia', 'Banco de Bogotá',
  'Davivienda', 'BBVA Colombia', 'Banco de Occidente', 'Banco Popular', 'Nequi', 'Daviplata'
]

export const errorPago = (status, message) => Object.assign(new Error(message), { status })

export const wompiActivo = () => Boolean(WOMPI_PUBLIC_KEY && WOMPI_INTEGRITY_SECRET)
export const proveedorEnLinea = () => (wompiActivo() ? 'wompi' : 'simulado')
const wompiApi = () => (WOMPI_PUBLIC_KEY.startsWith('pub_prod_')
  ? 'https://production.wompi.co/v1'
  : 'https://sandbox.wompi.co/v1')

const sha256 = (texto) => crypto.createHash('sha256').update(texto).digest('hex')
const mismoId = (a, b) => String(a?._id ?? a) === String(b?._id ?? b)

const PREFIJOS = { reserva: 'RES', pedido: 'PED', torneo: 'TOR', clase: 'CLA' }
const nuevaReferencia = (concepto) =>
  `PZ-${PREFIJOS[concepto]}-${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`

// ─── Reservas apartadas mientras se pagan ─────────────────────────────────────

// Cancela las reservas pendientes de pago cuyo plazo venció (libera el horario)
export const vencerReservasPendientes = async () => {
  const vencidas = await Reserva.find({ estado: 'pendiente', expira_en: { $ne: null, $lte: new Date() } }).distinct('_id')
  if (!vencidas.length) return 0
  await Reserva.updateMany({ _id: { $in: vencidas }, estado: 'pendiente' }, { estado: 'cancelada' })
  await Pago.updateMany(
    { concepto: 'reserva', referencia_id: { $in: vencidas }, estado: 'pendiente', proveedor: { $ne: 'wompi' } },
    { estado: 'anulado', mensaje: 'La reserva venció sin pagarse' }
  )
  return vencidas.length
}

// ¿Sigue libre el horario de una reserva? (para un pago que llega cuando ya había vencido)
const horarioLibre = async (r) => {
  const ocupada = await Reserva.exists({
    _id: { $ne: r._id },
    cancha_id: r.cancha_id,
    fecha: r.fecha,
    estado: { $ne: 'cancelada' },
    hora_inicio: { $lt: r.hora_fin },
    hora_fin: { $gt: r.hora_inicio }
  })
  if (ocupada) return false
  const bloqueos = await bloqueosDeTorneos(r.cancha_id, r.fecha)
  return !bloqueos.some(b => b.hora_inicio < r.hora_fin && b.hora_fin > r.hora_inicio)
}

// ─── Lo que se cobra ──────────────────────────────────────────────────────────

// Carga lo que se va a pagar: { usuario_id, monto, descripcion, pagado, cancelado, problema }.
// `problema` explica por qué no se puede pagar (o null)
export const cargarEntidad = async (concepto, id) => {
  if (concepto === 'reserva') {
    const r = await Reserva.findById(id).populate('cancha_id', 'nombre')
    if (!r) return null
    return {
      usuario_id: r.usuario_id,
      monto: r.precio,
      descripcion: `Reserva ${r.cancha_id?.nombre ?? 'de cancha'} · ${diaKey(r.fecha)} · ${r.hora_inicio}–${r.hora_fin}`,
      pagado: r.pagada,
      cancelado: r.estado === 'cancelada',
      problema: r.estado === 'cancelada'
        ? (r.expira_en ? 'La reserva venció porque no se pagó a tiempo; haz una nueva reserva' : 'La reserva está cancelada')
        : null
    }
  }

  if (concepto === 'pedido') {
    const p = await Pedido.findById(id)
    if (!p) return null
    const problemas = { cancelado: 'El pedido está cancelado', enviado: 'El pedido ya fue enviado' }
    return {
      usuario_id: p.usuario_id,
      monto: p.precio_total,
      descripcion: `Pedido #${String(p._id).slice(-6).toUpperCase()} de la tienda`,
      pagado: p.estado === 'pagado',
      cancelado: p.estado === 'cancelado',
      problema: problemas[p.estado] ?? null
    }
  }

  if (concepto === 'torneo') {
    const p = await Participante.findById(id).populate('torneo_id', 'nombre precio_inscripcion estado')
    if (!p) return null
    const torneo = p.torneo_id
    const cancelado = !torneo || torneo.estado === 'cancelado'
    return {
      usuario_id: p.usuario_id,
      monto: torneo?.precio_inscripcion ?? 0,
      descripcion: `Inscripción al torneo ${torneo?.nombre ?? ''}`.trim(),
      pagado: p.pago_confirmado,
      cancelado,
      problema: cancelado
        ? 'El torneo fue cancelado'
        : torneo.precio_inscripcion <= 0 ? 'Este torneo no tiene costo de inscripción' : null
    }
  }

  if (concepto === 'clase') {
    const ins = await InscripcionClase.findById(id)
    if (!ins) return null
    // Inscripciones antiguas sin monto: se toma de la tabla o del texto del precio
    const monto = ins.monto || precioClase(ins.clase_id, ins.grupo) ||
      Number(String(ins.precio ?? '').replace(/\D/g, '')) || 0
    return {
      usuario_id: ins.usuario_id,
      monto,
      descripcion: `Clase ${ins.clase_nombre} · ${ins.grupo} (mensualidad)`,
      pagado: ins.pago_confirmado,
      cancelado: ins.estado === 'cancelada',
      problema: ins.estado === 'cancelada' ? 'La inscripción a la clase está cancelada' : null
    }
  }

  return null
}

// Igual que cargarEntidad, pero comprobando que la pague su dueño y que se pueda pagar
export const obtenerCargo = async (concepto, id, usuario) => {
  if (concepto === 'reserva') await vencerReservasPendientes()
  const entidad = await cargarEntidad(concepto, id)
  if (!entidad || !mismoId(entidad.usuario_id, usuario._id)) {
    throw errorPago(404, 'No encontramos lo que quieres pagar')
  }
  if (entidad.pagado) throw errorPago(409, 'Esto ya está pagado')
  if (entidad.problema) throw errorPago(400, entidad.problema)
  if (!(entidad.monto > 0)) throw errorPago(400, 'No hay nada que pagar')
  return entidad
}

// ─── Efectos de un pago ───────────────────────────────────────────────────────

const marcarPagado = async ({ concepto, referencia_id: id }, pagado) => {
  if (concepto === 'reserva') {
    if (!pagado) return Reserva.updateOne({ _id: id }, { pagada: false })
    const r = await Reserva.findById(id)
    if (!r) return
    const cambios = { pagada: true }
    if (r.estado === 'pendiente') {
      Object.assign(cambios, { estado: 'confirmada', expira_en: null })
    } else if (r.estado === 'cancelada' && r.expira_en && await horarioLibre(r)) {
      // El pago llegó después de que venciera el plazo, pero el horario sigue libre
      Object.assign(cambios, { estado: 'confirmada', expira_en: null })
    }
    return Reserva.updateOne({ _id: id }, cambios)
  }
  if (concepto === 'pedido') {
    return pagado
      ? Pedido.updateOne({ _id: id, estado: 'pendiente' }, { estado: 'pagado' })
      : Pedido.updateOne({ _id: id, estado: 'pagado' }, { estado: 'pendiente' })
  }
  if (concepto === 'torneo') return Participante.updateOne({ _id: id }, { pago_confirmado: pagado })
  if (concepto === 'clase') return InscripcionClase.updateOne({ _id: id }, { pago_confirmado: pagado })
}

// Cambia el estado de un pago y aplica sus efectos. Es atómico: si dos avisos
// llegan a la vez (redirección y webhook), solo uno aplica el cambio.
// Transiciones: pendiente → aprobado | rechazado | anulado; aprobado → anulado
export const cambiarEstado = async (pago, estado, extra = {}) => {
  const desde = estado === 'anulado' ? ['pendiente', 'aprobado'] : ['pendiente']
  const anterior = await Pago.findOneAndUpdate(
    { _id: pago._id, estado: { $in: desde } },
    { ...extra, estado, ...(estado === 'aprobado' && { pagado_en: new Date() }) },
    { new: false }
  )
  const actual = await Pago.findById(pago._id)
  if (!anterior) return actual

  const filtro = { concepto: actual.concepto, referencia_id: actual.referencia_id }
  if (estado === 'aprobado') {
    await marcarPagado(actual, true)
    // Otros intentos que quedaron abiertos (efectivo, simulados) ya no hacen falta
    await Pago.updateMany(
      { ...filtro, _id: { $ne: actual._id }, estado: 'pendiente', proveedor: { $ne: 'wompi' } },
      { estado: 'anulado', mensaje: 'Pagado por otro medio' }
    )
  } else if (estado === 'anulado' && anterior.estado === 'aprobado') {
    const otroAprobado = await Pago.exists({ ...filtro, estado: 'aprobado' })
    if (!otroAprobado) await marcarPagado(actual, false)
  }
  return actual
}

// ─── Iniciar un pago ──────────────────────────────────────────────────────────

const urlCheckoutWompi = (pago, usuario) => {
  const centavos = pago.monto * 100
  const url = new URL('https://checkout.wompi.co/p/')
  url.searchParams.set('public-key', WOMPI_PUBLIC_KEY)
  url.searchParams.set('currency', 'COP')
  url.searchParams.set('amount-in-cents', String(centavos))
  url.searchParams.set('reference', pago.referencia)
  url.searchParams.set('signature:integrity', sha256(`${pago.referencia}${centavos}COP${WOMPI_INTEGRITY_SECRET}`))
  url.searchParams.set('redirect-url', `${CLIENT_URL}/pagos/resultado`)
  if (usuario.email) url.searchParams.set('customer-data:email', usuario.email)
  const nombre = [usuario.nombre, usuario.apellido].filter(Boolean).join(' ')
  if (nombre) url.searchParams.set('customer-data:full-name', nombre)
  return url.toString()
}

// Crea el pago. Devuelve { pago, checkout_url? }
export const iniciarPago = async ({ concepto, id, metodo }, usuario) => {
  const cargo = await obtenerCargo(concepto, id, usuario)
  const filtro = { concepto, referencia_id: id, estado: 'pendiente' }
  const base = {
    usuario_id: usuario._id,
    concepto,
    referencia_id: id,
    referencia: nuevaReferencia(concepto),
    descripcion: cargo.descripcion,
    monto: cargo.monto
  }

  if (metodo === 'efectivo') {
    // Una reserva que se paga en la sede queda confirmada (ya no vence)
    if (concepto === 'reserva') {
      await Reserva.updateOne({ _id: id, estado: 'pendiente' }, { estado: 'confirmada', expira_en: null })
    }
    const existente = await Pago.findOne({ ...filtro, proveedor: 'manual' })
    if (existente) return { pago: existente }
    const pago = await Pago.create({ ...base, metodo: 'efectivo', proveedor: 'manual' })
    return { pago }
  }

  const proveedor = proveedorEnLinea()
  if (proveedor === 'simulado' && !METODOS_EN_LINEA.includes(metodo)) {
    throw errorPago(400, 'Elige tarjeta, PSE, Nequi o efectivo')
  }

  // Los intentos simulados anteriores quedaron abandonados
  await Pago.updateMany({ ...filtro, proveedor: 'simulado' }, { estado: 'anulado', mensaje: 'Reemplazado por un nuevo intento' })
  // Mientras paga en la pasarela, la reserva sigue apartada
  if (concepto === 'reserva') {
    await Reserva.updateOne(
      { _id: id, estado: 'pendiente' },
      { expira_en: new Date(Date.now() + MINUTOS_PARA_PAGAR * 60 * 1000) }
    )
  }

  const pago = await Pago.create({
    ...base,
    // Con Wompi el método lo elige el usuario en la pasarela: se actualiza al confirmar
    metodo: proveedor === 'wompi' ? 'otro' : metodo,
    proveedor
  })
  return proveedor === 'wompi' ? { pago, checkout_url: urlCheckoutWompi(pago, usuario) } : { pago }
}

// ─── Pago simulado ────────────────────────────────────────────────────────────

const luhn = (numero) => {
  let suma = 0
  for (let i = 0; i < numero.length; i++) {
    let d = Number(numero[numero.length - 1 - i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    suma += d
  }
  return suma % 10 === 0
}

const marcaTarjeta = (n) => {
  if (/^4/.test(n)) return 'VISA'
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'MASTERCARD'
  if (/^3[47]/.test(n)) return 'AMEX'
  return 'TARJETA'
}

// Reglas del sandbox de Wompi: 4242 4242 4242 4242 aprueba y 4111 1111 1111 1111
// rechaza; Nequi 3991111111 aprueba y 3992222222 rechaza; en PSE el "Banco que rechaza"
// rechaza. Cualquier otro dato válido se aprueba. Devuelve { estado, extra }
export const simular = (datos) => {
  const { metodo } = datos
  if (!METODOS_EN_LINEA.includes(metodo)) throw errorPago(400, 'Método de pago inválido')

  if (metodo === 'tarjeta') {
    const numero = String(datos.numero ?? '').replace(/\D/g, '')
    if (numero.length < 13 || numero.length > 19 || !luhn(numero)) throw errorPago(400, 'El número de la tarjeta no es válido')
    if (String(datos.titular ?? '').trim().length < 3) throw errorPago(400, 'Escribe el nombre del titular')
    const [mm, aa] = String(datos.vence ?? '').split('/').map(Number)
    // Vence el último día del mes indicado
    const vence = new Date(2000 + aa, mm)
    if (!(mm >= 1 && mm <= 12) || Number.isNaN(aa) || vence <= new Date()) {
      throw errorPago(400, 'La tarjeta está vencida o la fecha no es válida')
    }
    if (!/^\d{3,4}$/.test(String(datos.cvv ?? ''))) throw errorPago(400, 'El CVV no es válido')
    const extra = { metodo, detalle: { marca: marcaTarjeta(numero), ultimos4: numero.slice(-4) } }
    return numero === '4111111111111111'
      ? { estado: 'rechazado', extra: { ...extra, mensaje: 'Tarjeta rechazada por el banco: fondos insuficientes' } }
      : { estado: 'aprobado', extra }
  }

  if (metodo === 'pse') {
    if (!BANCOS_PSE.includes(datos.banco)) throw errorPago(400, 'Elige tu banco')
    if (!/^\d{5,15}$/.test(String(datos.documento ?? ''))) throw errorPago(400, 'El número de documento no es válido')
    const extra = { metodo, detalle: { banco: datos.banco } }
    return datos.banco === 'Banco que rechaza'
      ? { estado: 'rechazado', extra: { ...extra, mensaje: 'El banco rechazó la transacción' } }
      : { estado: 'aprobado', extra }
  }

  const telefono = String(datos.telefono ?? '').replace(/\D/g, '')
  if (!/^3\d{9}$/.test(telefono)) throw errorPago(400, 'El celular de Nequi debe tener 10 dígitos y empezar por 3')
  const extra = { metodo, detalle: { telefono: `******${telefono.slice(-4)}` } }
  return telefono === '3992222222'
    ? { estado: 'rechazado', extra: { ...extra, mensaje: 'El pago fue rechazado en la app de Nequi' } }
    : { estado: 'aprobado', extra }
}

// ─── Wompi ────────────────────────────────────────────────────────────────────

const METODOS_WOMPI = { CARD: 'tarjeta', PSE: 'pse', NEQUI: 'nequi' }
const ESTADOS_WOMPI = { APPROVED: 'aprobado', DECLINED: 'rechazado', ERROR: 'rechazado', VOIDED: 'anulado' }

export const consultarTransaccionWompi = async (transaccionId) => {
  const res = await fetch(`${wompiApi()}/transactions/${encodeURIComponent(transaccionId)}`)
  if (!res.ok) throw errorPago(res.status === 404 ? 404 : 502, 'No se pudo consultar la transacción en Wompi')
  const { data } = await res.json()
  return data
}

// Aplica el estado de una transacción de Wompi a su pago (desde la redirección o el webhook)
export const procesarTransaccionWompi = async (tx) => {
  const pago = await Pago.findOne({ referencia: tx?.reference, proveedor: 'wompi' })
  if (!pago) return null

  if (tx.amount_in_cents !== pago.monto * 100 || tx.currency !== 'COP') {
    console.error(`Pago ${pago.referencia}: el monto de Wompi no coincide`)
    return cambiarEstado(pago, 'rechazado', { transaccion_id: tx.id, mensaje: 'El monto de la transacción no coincide' })
  }

  const pm = tx.payment_method ?? {}
  const datos = {
    transaccion_id: tx.id,
    metodo: METODOS_WOMPI[tx.payment_method_type] ?? 'otro',
    detalle: {
      marca: pm.extra?.brand,
      ultimos4: pm.extra?.last_four,
      banco: pm.extra?.financial_institution_name,
      telefono: pm.phone_number ? `******${String(pm.phone_number).slice(-4)}` : undefined
    },
    mensaje: tx.status_message ?? ''
  }

  const estado = ESTADOS_WOMPI[tx.status]
  if (!estado) {
    // Sigue pendiente: solo se guarda el id de la transacción
    await Pago.updateOne({ _id: pago._id, estado: 'pendiente' }, { transaccion_id: tx.id })
    return Pago.findById(pago._id)
  }
  return cambiarEstado(pago, estado, datos)
}

// Firma de los eventos de Wompi: SHA256 de los valores de signature.properties
// (en orden) + timestamp + secreto de eventos
export const eventoWompiValido = (evento) => {
  if (!WOMPI_EVENTS_SECRET || !evento?.signature?.checksum || !Array.isArray(evento.signature.properties)) return false
  const valor = (ruta) => ruta.split('.').reduce((obj, clave) => obj?.[clave], evento.data)
  const texto = evento.signature.properties.map(valor).join('') + evento.timestamp + WOMPI_EVENTS_SECRET
  const esperado = Buffer.from(sha256(texto))
  const recibido = Buffer.from(String(evento.signature.checksum).toLowerCase())
  return esperado.length === recibido.length && crypto.timingSafeEqual(esperado, recibido)
}

// ─── Usados desde otros controladores ─────────────────────────────────────────

// Al cancelar algo, sus pagos pendientes ya no aplican (los de Wompi los resuelve la pasarela)
export const cancelarPagosPendientes = (concepto, id) => Pago.updateMany(
  { concepto, referencia_id: id, estado: 'pendiente', proveedor: { $ne: 'wompi' } },
  { estado: 'anulado', mensaje: 'Se canceló lo que se iba a pagar' }
)

// El admin marca algo como pagado a mano (pago recibido en la sede): queda un pago
// aprobado como constancia. No hace nada si ya había uno aprobado
export const registrarPagoManual = async (concepto, id, adminId) => {
  const filtro = { concepto, referencia_id: id }
  if (await Pago.exists({ ...filtro, estado: 'aprobado' })) return null
  const pendiente = await Pago.findOne({ ...filtro, estado: 'pendiente', proveedor: 'manual' })
  if (pendiente) return cambiarEstado(pendiente, 'aprobado', { registrado_por: adminId })

  const entidad = await cargarEntidad(concepto, id)
  if (!entidad?.usuario_id || !(entidad.monto > 0)) return null
  const pago = await Pago.create({
    usuario_id: entidad.usuario_id,
    concepto,
    referencia_id: id,
    referencia: nuevaReferencia(concepto),
    descripcion: entidad.descripcion,
    monto: entidad.monto,
    metodo: 'efectivo',
    proveedor: 'manual',
    registrado_por: adminId
  })
  return cambiarEstado(pago, 'aprobado', { registrado_por: adminId })
}

// El admin desmarca algo como pagado: sus pagos aprobados quedan anulados
export const anularPagosAprobados = (concepto, id, mensaje) => Pago.updateMany(
  { concepto, referencia_id: id, estado: 'aprobado' },
  { estado: 'anulado', mensaje }
)
