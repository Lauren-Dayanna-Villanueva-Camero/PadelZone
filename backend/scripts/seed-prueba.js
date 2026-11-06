// Datos de prueba: usuarios usuario1..usuarioN (contraseña 123456), canchas,
// productos, torneos en todos los estados, reservas, pedidos, clases y carrusel.
//
//   npm run seed           → crea los datos (si ya existen, no hace nada)
//   npm run seed -- --reset → borra los datos de prueba creados por este script
import 'dotenv/config'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import User from '../src/models/user.model.js'
import Media from '../src/models/media.model.js'
import Cancha from '../src/models/cancha.model.js'
import Producto from '../src/models/producto.model.js'
import Torneo from '../src/models/torneo.model.js'
import Participante from '../src/models/participante.model.js'
import Partido from '../src/models/partido.model.js'
import Reserva from '../src/models/reserva.model.js'
import Pedido from '../src/models/pedido.model.js'
import PedidoItem from '../src/models/pedidoItem.model.js'
import InscripcionClase from '../src/models/inscripcionClase.model.js'
import Carrusel from '../src/models/carrusel.model.js'
import { checkCloudinary, cloudinaryEnabled, uploadBuffer, destroyImage } from '../src/libs/cloudinary.js'
import { organizarEquipos } from '../src/libs/torneos.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const IMG_SRC = path.resolve(__dirname, '../../frontend/src/img')
const IMG_PUBLIC = path.resolve(__dirname, '../../frontend/public/img')

const TOTAL_USUARIOS = 40
const PASSWORD = '123456'
const emailDe = (n) => `usuario${n}@padelzone.com`
const SEED_EMAIL = /^usuario\d+@padelzone\.com$/

// PRNG con semilla: cada ejecución genera los mismos datos
let semilla = 20261029
const rand = () => {
  semilla = (semilla * 1664525 + 1013904223) % 4294967296
  return semilla / 4294967296
}
const entre = (min, max) => min + Math.floor(rand() * (max - min + 1))
const elegir = (lista) => lista[Math.floor(rand() * lista.length)]

const pad = (n) => String(n).padStart(2, '0')
const diaKey = (offset) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const fechaUTC = (key) => new Date(`${key}T00:00:00.000Z`)
const haceDias = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000)

// ─── Catálogo ───────────────────────────────────────

const CANCHAS = [
  {
    nombre: 'Cancha 2', tipo: 'Interior', techada: true, precio_por_hora: 160000, img: 'Cancha2.jpg',
    caracteristicas: ['Techada', 'Iluminación LED', 'Césped sintético', 'Vestuarios']
  },
  {
    nombre: 'Cancha 4', tipo: 'Exterior', techada: false, precio_por_hora: 140000, img: 'Cancha4.jpg',
    caracteristicas: ['Iluminación nocturna', 'Graderías', 'Césped sintético']
  },
  {
    nombre: 'Cancha 5', tipo: 'Interior', techada: true, precio_por_hora: 200000, img: 'Cancha5.jpg',
    caracteristicas: ['Panorámica (cristal 360°)', 'Climatizada', 'Iluminación LED', 'Zona de descanso']
  }
]

const PRODUCTOS = [
  { nombre: 'Pala Adidas Cross It Light 3.4', categoria: 'pala', precio: 890000, stock: 8, img: 'adidas-pala-de-padel-cross-it-light-3.4-2025_1.webp', descripcion: 'Pala ligera de control con núcleo EVA soft, ideal para nivel intermedio.' },
  { nombre: 'Pala Bullpadel Vertex 04', categoria: 'pala', precio: 1150000, stock: 3, descripcion: 'Pala de potencia en forma de diamante para jugadores avanzados.' },
  { nombre: 'Pala Head Speed Pro', categoria: 'pala', precio: 980000, stock: 0, descripcion: 'Pala polivalente de fibra de carbono. (Agotada: para probar sin stock)' },
  { nombre: 'Camiseta Dry Fit PadelZone', categoria: 'ropa', precio: 85000, stock: 30, img: 'camisa dry fit.jpg', descripcion: 'Camiseta transpirable de secado rápido con logo PadelZone.' },
  { nombre: 'Short Deportivo Pro', categoria: 'ropa', precio: 70000, stock: 20, descripcion: 'Short elástico con bolsillos para bolas.' },
  { nombre: 'Gorra PadelZone', categoria: 'ropa', precio: 40000, stock: 10, activo: false, descripcion: 'Producto inactivo: no debe aparecer en la tienda.' },
  { nombre: 'Grip Antideslizante (x3)', categoria: 'accesorios', precio: 25000, stock: 50, img: 'grip antidezlizante.jpg', descripcion: 'Pack de 3 overgrips antideslizantes.' },
  { nombre: 'Paletero Pro', categoria: 'accesorios', precio: 260000, stock: 6, img: 'paletero pro.webp', descripcion: 'Paletero térmico con compartimento para 3 palas y zapatillas.' },
  { nombre: 'Muñequera y Cinturón', categoria: 'accesorios', precio: 45000, stock: 15, img: 'munequera-y-cinturon.webp', descripcion: 'Set de muñequera absorbente y cinturón porta bolas.' },
  { nombre: 'Tubo de 3 Bolas Presurizadas', categoria: 'accesorios', precio: 32000, stock: 100, img: 'tubo-de-3-bolas-de-padel-presurizadas-kuikma-pb-club.jpg', descripcion: 'Bolas de pádel presurizadas para club.' },
  { nombre: 'Zapatillas Pro Clay', categoria: 'calzado', precio: 420000, stock: 5, descripcion: 'Suela espiga para césped sintético con arena.' },
  { nombre: 'Zapatillas Gel Padel', categoria: 'calzado', precio: 510000, stock: 1, descripcion: 'Última unidad: para probar stock insuficiente.' }
]

const SLIDES = [
  { titulo: 'TORNEOS TODO EL AÑO', subtitulo: 'Inscríbete con tu pareja y compite', img: 'padel1.jpg', orden: 3 },
  { titulo: 'CLASES DE VERANO', subtitulo: 'Grupos reducidos para todas las edades', img: 'verano.jpg', orden: 4 },
  { titulo: 'RESERVA TU CANCHA', subtitulo: 'Canchas interiores y exteriores desde $140.000 la hora', img: 'canchapadel1.jpg', orden: 5 }
]

// Copia del catálogo de frontend/src/pages/clases/clases.jsx
const CLASES = [
  { id: 1, nombre: 'Clases Regulares', tipo: 'Regular', color: '#1a73e8', dias: 'Lunes, Miércoles y Viernes', horarios: ['8:00 AM', '10:00 AM', '4:00 PM', '6:00 PM'],
    grupos: [['10 - 14 años', 'Valentina Salazar', '$180.000 / mes'], ['15 - 21 años', 'Sofía Restrepo', '$200.000 / mes'], ['22 años en adelante', 'Carlos Mendoza', '$220.000 / mes']] },
  { id: 2, nombre: 'Clases Intensivas', tipo: 'Intensiva', color: '#e53935', dias: 'Lunes a Sábado', horarios: ['7:00 AM', '9:00 AM', '3:00 PM', '5:00 PM'],
    grupos: [['10 - 14 años', 'Valentina Salazar', '$280.000 / mes'], ['15 - 21 años', 'Andrés Quiroga', '$320.000 / mes'], ['22 años en adelante', 'Andrés Quiroga', '$350.000 / mes']] },
  { id: 3, nombre: 'Clases de Verano', tipo: 'Verano', color: '#f9a825', dias: 'Martes, Jueves y Sábado', horarios: ['8:00 AM', '10:00 AM', '2:00 PM', '4:00 PM'],
    grupos: [['10 - 14 años', 'Valentina Salazar', '$150.000 / mes'], ['15 - 21 años', 'Sofía Restrepo', '$170.000 / mes'], ['22 años en adelante', 'Carlos Mendoza', '$190.000 / mes']] },
  { id: 4, nombre: 'Clases Fin de Semana', tipo: 'Fin de Semana', color: '#43a047', dias: 'Sábado y Domingo', horarios: ['9:00 AM', '11:00 AM', '3:00 PM', '5:00 PM'],
    grupos: [['10 - 14 años', 'Valentina Salazar', '$160.000 / mes'], ['15 - 21 años', 'Sofía Restrepo', '$180.000 / mes'], ['22 años en adelante', 'Carlos Mendoza', '$200.000 / mes']] }
]

// Torneos: participantes por número de usuario.
// parejas: [a, b] inscritos ambos y declarados mutuamente
// declaradas: [a, b] solo a se inscribe y declara a b
const TORNEOS = [
  {
    nombre: 'Torneo Amateur de Noviembre', tipo_torneo: 'Amateur', inicio: 16, fin: 18, cupo_maximo_parejas: 8, precio_inscripcion: 40000, estado: 'activo',
    parejas: [[6, 7], [8, 9], [10, 11]], declaradas: [[12, 39]], sueltos: [13, 14, 15]
    // 6 de 8 parejas; al cerrar inscripciones queda 1 suelto sin pareja
  },
  {
    nombre: 'Copa Comunidad PadelZone', tipo_torneo: 'Comunidad', inicio: 9, fin: 10, cupo_maximo_parejas: 4, precio_inscripcion: 20000, estado: 'activo',
    parejas: [], declaradas: [], sueltos: [16, 17, 18, 19, 20, 21]
    // 3 de 4 parejas: una pareja más (con pareja_email) la llena y se cierra sola
  },
  {
    nombre: 'Open Profesional PadelZone 2026', tipo_torneo: 'Profesional', inicio: -2, fin: 4, cupo_maximo_parejas: 8, precio_inscripcion: 120000, estado: 'en_curso',
    parejas: [[1, 2], [23, 24], [25, 26], [27, 28]], declaradas: [], sueltos: [29, 30, 31, 32, 33, 34, 35, 36], organizar: true
  },
  {
    nombre: 'Liga de Verano 2026', tipo_torneo: 'Amateur', inicio: -89, fin: -87, cupo_maximo_parejas: 6, precio_inscripcion: 35000, estado: 'finalizado',
    parejas: [[3, 4], [5, 6]], declaradas: [], sueltos: [7, 8, 9, 10, 11, 12, 13, 14], organizar: true
  },
  {
    nombre: 'Torneo Relámpago Halloween', tipo_torneo: 'Comunidad', inicio: 2, fin: 2, cupo_maximo_parejas: 8, precio_inscripcion: 15000, estado: 'cancelado',
    parejas: [], declaradas: [], sueltos: [37, 38, 3, 4]
  },
  {
    nombre: 'Gran Torneo Navideño', tipo_torneo: 'Profesional', inicio: 44, fin: 46, cupo_maximo_parejas: 16, precio_inscripcion: 80000, estado: 'activo',
    parejas: [], declaradas: [], sueltos: []
  }
]

const CIUDADES = [
  ['Neiva', 'Calle 8 # 5-32'], ['Neiva', 'Carrera 16 # 21-10'], ['Pitalito', 'Calle 5 # 3-40'],
  ['Bogotá', 'Av. Calle 72 # 10-34'], ['Medellín', 'Carrera 43A # 1-50'], ['Cali', 'Calle 5 # 66-20']
]
const OPERADORES = ['Servientrega', 'Coordinadora', 'Interrapidísimo', 'Envía']

// ─── Utilidades ─────────────────────────────────────

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }

const subirImagen = async (dir, archivo, tipo, adminId) => {
  const buffer = fs.readFileSync(path.join(dir, archivo))
  const _id = new mongoose.Types.ObjectId()
  const media = {
    _id,
    nombre_archivo: archivo,
    tipo,
    mime_type: MIME[path.extname(archivo).toLowerCase()],
    tamano: buffer.length,
    subida_por: adminId
  }
  if (cloudinaryEnabled()) {
    try {
      const r = await uploadBuffer(buffer, tipo)
      media.url = r.secure_url
      media.public_id = r.public_id
    } catch (error) {
      console.error(`  Cloudinary falló con ${archivo}, se guarda en MongoDB:`, error.message)
    }
  }
  if (!media.url) {
    media.url = `/api/media/${_id}/archivo`
    media.data = buffer
  }
  await Media.create(media)
  return _id
}

// Las fechas de creación son automáticas; se reescriben para tener historial
const fijarFecha = (Model, id, campo, fecha) =>
  Model.collection.updateOne({ _id: id }, { $set: { [campo]: fecha } })

// ─── Reset ──────────────────────────────────────────

const reset = async () => {
  const usuarios = await User.find({ email: SEED_EMAIL }).select('_id')
  const ids = usuarios.map(u => u._id)

  const torneos = await Torneo.find({ nombre: { $in: TORNEOS.map(t => t.nombre) } }).select('_id')
  const canchas = await Cancha.find({ nombre: { $in: CANCHAS.map(c => c.nombre) } })
  const productos = await Producto.find({ nombre: { $in: PRODUCTOS.map(p => p.nombre) } })
  const slides = await Carrusel.find({ titulo: { $in: SLIDES.map(s => s.titulo) } })

  const pedidos = await Pedido.find({ usuario_id: { $in: ids } }).select('_id')
  await PedidoItem.deleteMany({ pedido_id: { $in: pedidos.map(p => p._id) } })
  await Pedido.deleteMany({ _id: { $in: pedidos.map(p => p._id) } })
  await Reserva.deleteMany({ $or: [{ usuario_id: { $in: ids } }, { cancha_id: { $in: canchas.map(c => c._id) } }] })
  await Participante.deleteMany({ $or: [{ usuario_id: { $in: ids } }, { torneo_id: { $in: torneos.map(t => t._id) } }] })
  await InscripcionClase.deleteMany({ usuario_id: { $in: ids } })
  await Partido.deleteMany({ torneo_id: { $in: torneos.map(t => t._id) } })
  await Torneo.deleteMany({ _id: { $in: torneos.map(t => t._id) } })
  await Cancha.deleteMany({ _id: { $in: canchas.map(c => c._id) } })
  await Producto.deleteMany({ _id: { $in: productos.map(p => p._id) } })
  await Carrusel.deleteMany({ _id: { $in: slides.map(s => s._id) } })

  const mediaIds = [...canchas, ...productos, ...slides].map(d => d.imagen_id).filter(Boolean)
  const medias = await Media.find({ _id: { $in: mediaIds } })
  for (const m of medias) {
    if (m.public_id && cloudinaryEnabled()) await destroyImage(m.public_id).catch(() => {})
  }
  await Media.deleteMany({ _id: { $in: mediaIds } })
  await User.deleteMany({ _id: { $in: ids } })

  console.log(`Borrados: ${ids.length} usuarios, ${canchas.length} canchas, ${productos.length} productos, ` +
    `${torneos.length} torneos, ${slides.length} slides, ${medias.length} imágenes y sus reservas/pedidos/inscripciones`)
}

// ─── Seed ───────────────────────────────────────────

const seed = async () => {
  if (await User.exists({ email: emailDe(1) })) {
    console.log('Los datos de prueba ya existen. Usa "npm run seed -- --reset" para borrarlos y volver a crearlos.')
    return
  }

  const admin = await User.findOne({ rol: 'admin', activo: true })
  if (!admin) throw new Error('No hay ningún usuario admin activo para figurar como creador')
  console.log(`Admin creador: ${admin.email}`)

  const resumen = {}

  // Usuarios
  const password_hash = await bcrypt.hash(PASSWORD, 10)
  const usuarios = await User.insertMany(Array.from({ length: TOTAL_USUARIOS }, (_, i) => ({
    nombre: `usuario${i + 1}`,
    apellido: 'Prueba',
    email: emailDe(i + 1),
    password_hash,
    telefono: `31${entre(0, 9)}${String(entre(1000000, 9999999))}`,
    rol: 'usuario',
    // El último queda desactivado para probar el bloqueo de login
    activo: i + 1 !== TOTAL_USUARIOS
  })))
  const u = (n) => usuarios[n - 1]
  resumen.usuarios = usuarios.length

  // Canchas
  for (const c of CANCHAS) {
    if (await Cancha.exists({ nombre: c.nombre })) continue
    const { img, ...datos } = c
    const imagen_id = await subirImagen(IMG_SRC, img, 'cancha', admin._id)
    await Cancha.create({ ...datos, imagen_id, creada_por: admin._id })
    resumen.canchas = (resumen.canchas || 0) + 1
  }

  // Productos
  for (const p of PRODUCTOS) {
    if (await Producto.exists({ nombre: p.nombre })) continue
    const { img, ...datos } = p
    const imagen_id = img ? await subirImagen(IMG_SRC, img, 'producto', admin._id) : undefined
    await Producto.create({ ...datos, imagen_id, creado_por: admin._id })
    resumen.productos = (resumen.productos || 0) + 1
  }

  // Carrusel
  for (const s of SLIDES) {
    if (await Carrusel.exists({ titulo: s.titulo })) continue
    const { img, ...datos } = s
    const imagen_id = await subirImagen(IMG_PUBLIC, img, 'carrusel', admin._id)
    await Carrusel.create({ ...datos, imagen_id, editado_por: admin._id })
    resumen.slides = (resumen.slides || 0) + 1
  }

  // Torneos y participantes
  resumen.torneos = 0
  resumen.participantes = 0
  for (const t of TORNEOS) {
    if (await Torneo.exists({ nombre: t.nombre })) continue
    const torneo = await Torneo.create({
      nombre: t.nombre,
      tipo_torneo: t.tipo_torneo,
      fecha_inicio: fechaUTC(diaKey(t.inicio)),
      fecha_fin: fechaUTC(diaKey(t.fin)),
      cupo_maximo_parejas: t.cupo_maximo_parejas,
      precio_inscripcion: t.precio_inscripcion,
      estado: t.estado
    })
    resumen.torneos++

    const filas = [
      ...t.parejas.flatMap(([a, b]) => [[a, b], [b, a]]),
      ...t.declaradas,
      ...t.sueltos.map(n => [n, null])
    ]
    const pagado = t.estado === 'en_curso' || t.estado === 'finalizado'
    for (const [i, [n, pareja]] of filas.entries()) {
      const p = await Participante.create({
        torneo_id: torneo._id,
        usuario_id: u(n)._id,
        pareja_usuario_id: pareja ? u(pareja)._id : undefined,
        pago_confirmado: pagado || rand() < 0.4
      })
      // Orden de inscripción escalonado (importa para resolver parejas)
      await fijarFecha(Participante, p._id, 'fecha_inscripcion', new Date(haceDias(20).getTime() + i * 3600000))
      resumen.participantes++
    }
    if (t.organizar) await organizarEquipos(torneo._id)
  }

  // Reservas: pasadas, futuras y algunas canceladas, sin solapes
  const canchas = await Cancha.find({ activa: true })
  const ocupadas = await Reserva.find({ estado: { $ne: 'cancelada' } }).select('cancha_id fecha hora_inicio hora_fin')
  const choca = (canchaId, fecha, ini, fin) => ocupadas.some(r =>
    r.cancha_id.equals(canchaId) && r.fecha.getTime() === fecha.getTime() &&
    r.hora_inicio < fin && r.hora_fin > ini)

  resumen.reservas = 0
  for (let k = 0; k < 60 && resumen.reservas < 45; k++) {
    const usuario = u(entre(1, 30))
    const cancha = elegir(canchas)
    const offset = k < 12 ? entre(-20, -1) : entre(0, 14)
    const fecha = fechaUTC(diaKey(offset))
    const hIni = entre(offset === 0 ? Math.max(new Date().getHours() + 1, 7) : 7, 21)
    const hFin = Math.min(hIni + entre(1, 2), 23)
    if (hFin <= hIni) continue
    const ini = `${pad(hIni)}:00`
    const fin = `${pad(hFin)}:00`
    if (choca(cancha._id, fecha, ini, fin)) continue

    const estado = rand() < 0.12 ? 'cancelada' : 'confirmada'
    const r = await Reserva.create({
      usuario_id: usuario._id,
      cancha_id: cancha._id,
      fecha,
      hora_inicio: ini,
      hora_fin: fin,
      precio: cancha.precio_por_hora * (hFin - hIni),
      estado
    })
    await fijarFecha(Reserva, r._id, 'fecha_creacion', haceDias(Math.max(1, -offset + entre(1, 5))))
    if (estado !== 'cancelada') ocupadas.push(r)
    resumen.reservas++
  }

  // Pedidos: descuentan stock salvo los cancelados
  const productos = await Producto.find({ activo: true, stock: { $gt: 0 } })
  const estados = ['pendiente', 'pendiente', 'pagado', 'pagado', 'enviado', 'enviado', 'cancelado']
  resumen.pedidos = 0
  for (let k = 0; k < 18; k++) {
    const usuario = u((k % 15) + 1)
    const estado = estados[k % estados.length]
    const elegidos = [...new Set(Array.from({ length: entre(1, 3) }, () => elegir(productos)))]

    const items = []
    for (const prod of elegidos) {
      const fresco = await Producto.findById(prod._id)
      const cantidad = Math.min(entre(1, 3), fresco.stock)
      if (cantidad < 1) continue
      items.push({ prod: fresco, cantidad })
    }
    if (!items.length) continue

    const subtotal = items.reduce((s, it) => s + it.prod.precio * it.cantidad, 0)
    const precio_envio = subtotal >= 300000 ? 0 : 15000
    const [ciudad, direccion] = elegir(CIUDADES)
    const pedido = await Pedido.create({
      usuario_id: usuario._id,
      subtotal,
      precio_envio,
      precio_total: subtotal + precio_envio,
      estado,
      ciudad,
      direccion_envio: direccion,
      telefono_envio: usuario.telefono,
      ...(estado === 'enviado' && { operador_logistico: elegir(OPERADORES), numero_guia: String(entre(100000000, 999999999)) })
    })
    await PedidoItem.insertMany(items.map(it => ({
      pedido_id: pedido._id,
      producto_id: it.prod._id,
      nombre: it.prod.nombre,
      precio_unitario: it.prod.precio,
      cantidad: it.cantidad
    })))
    if (estado !== 'cancelado') {
      for (const it of items) await Producto.updateOne({ _id: it.prod._id }, { $inc: { stock: -it.cantidad } })
    }
    await fijarFecha(Pedido, pedido._id, 'fecha_pedido', haceDias(entre(0, 25)))
    resumen.pedidos++
  }

  // Inscripciones a clases
  const niveles = ['principiante', 'intermedio', 'avanzado']
  resumen.inscripcionesClases = 0
  for (let k = 0; k < 16; k++) {
    const usuario = u(k + 1)
    const clase = CLASES[k % CLASES.length]
    const g = (k * 7) % 3
    const [grupo, profesor, precio] = clase.grupos[g]
    // Edad acorde al grupo elegido
    const edad = [entre(10, 14), entre(15, 21), entre(22, 50)][g]
    const nacimiento = `${new Date().getFullYear() - edad}-${pad(entre(1, 12))}-${pad(entre(1, 28))}`
    const ins = await InscripcionClase.create({
      usuario_id: usuario._id,
      clase_id: clase.id,
      clase_nombre: clase.nombre,
      tipo_clase: clase.tipo,
      color: clase.color,
      grupo,
      profesor,
      dias: clase.dias,
      horario: elegir(clase.horarios),
      precio,
      nivel: elegir(niveles),
      nombre_alumno: g === 0 ? `Hijo de ${usuario.nombre} Prueba` : `${usuario.nombre} Prueba`,
      telefono: usuario.telefono,
      fecha_nacimiento: fechaUTC(nacimiento),
      estado: k === 15 ? 'cancelada' : 'confirmada'
    })
    await fijarFecha(InscripcionClase, ins._id, 'fecha_inscripcion', haceDias(entre(1, 30)))
    resumen.inscripcionesClases++
  }

  console.log('Creado:', resumen)
}

// ─── Main ───────────────────────────────────────────

await mongoose.connect(process.env.MONGODB_URI)
await checkCloudinary()
try {
  if (process.argv.includes('--reset')) await reset()
  else await seed()
} catch (error) {
  console.error('Error en el seed:', error)
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}
