// Datos de prueba para probar todas las funcionalidades: usuarios usuario1..usuarioN
// (contraseña 123456), canchas, productos, carrusel, reservas, pedidos, clases y
// torneos en todos sus estados (con cuadro, resultados, horarios y canchas
// apartadas), además de solicitudes de torneo de empresas en todos sus estados.
// El detalle de cada caso está en la sección "Datos de prueba" del README.
//
//   npm run seed           → crea los datos (si ya existen, no hace nada)
//   npm run seed -- --reset → borra los datos de prueba creados por este script
//
// Si la base no tiene ningún admin activo se crea admin.prueba@padelzone.com
// (contraseña 123456), que también se borra con --reset.
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
import SolicitudTorneo from '../src/models/solicitudTorneo.model.js'
import Reserva from '../src/models/reserva.model.js'
import Pedido from '../src/models/pedido.model.js'
import PedidoItem from '../src/models/pedidoItem.model.js'
import InscripcionClase from '../src/models/inscripcionClase.model.js'
import Carrusel from '../src/models/carrusel.model.js'
import { checkCloudinary, cloudinaryEnabled, uploadBuffer, destroyImage } from '../src/libs/cloudinary.js'
import { organizarEquipos, llaveSiguiente } from '../src/libs/torneos.js'
import { bloqueosDeTorneos } from '../src/libs/horarios.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const IMG_SRC = path.resolve(__dirname, '../../frontend/src/img')
const IMG_PUBLIC = path.resolve(__dirname, '../../frontend/public/img')

const TOTAL_USUARIOS = 40
const PASSWORD = '123456'
const emailDe = (n) => `usuario${n}@padelzone.com`
const SEED_EMAIL = /^usuario\d+@padelzone\.com$/
const ADMIN_PRUEBA = 'admin.prueba@padelzone.com'

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

// Torneos: participantes por número de usuario. apertura/cierre/inicio/fin: días
// desde hoy. parejas: [a, b] inscritos ambos y declarados mutuamente;
// declaradas: [a, b] solo a se inscribe y declara a b (b no tiene inscripción propia).
// franja/duracion: horario diario de los partidos; canchas: canchas apartadas
// (bloquean las reservas en esos días y franja).
// organizar: arma parejas, cuadro y horarios; resultados: rondas ya jugadas
// ('todas' = torneo terminado con campeón).
const TORNEOS = [
  {
    // Inscripciones abiertas con canchas apartadas: 6 de 8 parejas; al cerrar
    // inscripciones queda 1 suelto sin pareja. Reservar Cancha 2 o 4 de 8:00 a
    // 14:00 en esos días da error.
    nombre: 'Torneo Amateur de Noviembre', apertura: -5, cierre: 14, inicio: 16, fin: 18,
    tipo_torneo: 'Amateur', cupo_maximo_parejas: 8, precio_inscripcion: 40000, estado: 'activo',
    franja: ['08:00', '14:00'], canchas: ['Cancha 2', 'Cancha 4'],
    parejas: [[6, 7], [8, 9], [10, 11]], declaradas: [[12, 39]], sueltos: [13, 14, 15]
  },
  {
    // 3 de 4 parejas: una inscripción más con pareja_email la llena y se cierra sola
    nombre: 'Copa Comunidad PadelZone', apertura: -10, cierre: 7, inicio: 9, fin: 10,
    tipo_torneo: 'Comunidad', cupo_maximo_parejas: 4, precio_inscripcion: 20000, estado: 'activo',
    franja: ['09:00', '18:00'],
    parejas: [], declaradas: [], sueltos: [16, 17, 18, 19, 20, 21]
  },
  {
    // En curso: cuartos jugados (con ganadores), semifinales programadas y la
    // final sin horario (por definir) para probar el ajuste manual
    nombre: 'Open Profesional PadelZone 2026', apertura: -20, cierre: -3, inicio: -2, fin: 4,
    tipo_torneo: 'Profesional', cupo_maximo_parejas: 8, precio_inscripcion: 120000, estado: 'en_curso',
    franja: ['16:00', '22:00'], canchas: ['Cancha 2', 'Cancha 4'],
    parejas: [[1, 2], [23, 24], [25, 26], [27, 28]], declaradas: [], sueltos: [29, 30, 31, 32, 33, 34, 35, 36],
    organizar: true, resultados: 1, finalSinHorario: true
  },
  {
    // Cierre de inscripciones vencido pero aún activo: la primera consulta a la
    // API lo cierra sola y arma parejas, cuadro y horarios (queda 1 sin pareja)
    nombre: 'Torneo Express Cierre Automático', apertura: -12, cierre: -1, inicio: 1, fin: 2,
    tipo_torneo: 'Amateur', cupo_maximo_parejas: 8, precio_inscripcion: 25000, estado: 'activo',
    franja: ['18:00', '22:00'],
    parejas: [[33, 34]], declaradas: [[35, 38]], sueltos: [1, 2, 5, 6, 9]
  },
  {
    // Finalizado con campeón: 6 parejas en un cuadro de 8 (2 BYE)
    nombre: 'Liga de Verano 2026', apertura: -110, cierre: -91, inicio: -89, fin: -87,
    tipo_torneo: 'Amateur', cupo_maximo_parejas: 6, precio_inscripcion: 35000, estado: 'finalizado',
    franja: ['08:00', '20:00'],
    parejas: [[3, 4], [5, 6]], declaradas: [], sueltos: [7, 8, 9, 10, 11, 12, 13, 14],
    organizar: true, resultados: 'todas'
  },
  {
    nombre: 'Torneo Relámpago Halloween', apertura: -10, cierre: 1, inicio: 2, fin: 2,
    tipo_torneo: 'Comunidad', cupo_maximo_parejas: 8, precio_inscripcion: 15000, estado: 'cancelado',
    parejas: [], declaradas: [], sueltos: [37, 38, 3, 4]
  },
  {
    // Las inscripciones aún no abren: sale como "Próximamente"
    nombre: 'Gran Torneo Navideño', apertura: 5, cierre: 40, inicio: 44, fin: 46,
    tipo_torneo: 'Profesional', cupo_maximo_parejas: 16, precio_inscripcion: 80000, estado: 'activo',
    franja: ['09:00', '21:00'], duracion: 60,
    parejas: [], declaradas: [], sueltos: []
  }
]

// Solicitudes de torneo de empresas (usuario = número del solicitante).
// aprobada: se crea su torneo como lo haría el admin; con convenio queda vigente y
// el solicitante ve el descuento al cotizar otro torneo en "Organiza tu torneo".
// conReserva: antes se crea una reserva que se cruza, para ver el aviso de cruce.
const SOLICITUDES = [
  {
    usuario: 5, estado: 'pendiente', modalidad: 'bloque',
    empresa: { nombre: 'Huila Tech S.A.S.', nit: '901234567-8', contacto: 'usuario5 Prueba', telefono: '3101234567' },
    nombre_torneo: 'Copa Empresarial Huila Tech', tipo_torneo: 'Comunidad',
    descripcion: 'Torneo de integración para los empleados de la empresa.',
    inicio: 25, fin: 26, franja: ['08:00', '14:00'], canchas: ['Cancha 4'],
    cupo_maximo_parejas: 8, precio_inscripcion: 0, apertura: 1, cierre: 20
  },
  {
    // Pendiente con una reserva que se cruza: el admin no puede aprobarla
    usuario: 11, estado: 'pendiente', modalidad: 'bloque',
    empresa: { nombre: 'Colegio Santa Librada', nit: '', contacto: 'usuario11 Prueba', telefono: '3157654321' },
    nombre_torneo: 'Interclases Santa Librada', tipo_torneo: 'Amateur',
    descripcion: 'Torneo entre cursos de bachillerato.',
    inicio: 22, fin: 23, franja: ['09:00', '15:00'], canchas: ['Cancha 2'],
    cupo_maximo_parejas: 6, precio_inscripcion: 10000, apertura: 2, cierre: 18,
    conReserva: { usuario: 3, dia: 22, hora_inicio: '10:00', hora_fin: '12:00' }
  },
  {
    // Convenio de 6 meses aprobado y vigente (15 % de descuento) con su torneo
    usuario: 8, estado: 'aprobada', modalidad: 'convenio', convenio_meses: 6,
    empresa: { nombre: 'Café Huila Exportaciones', nit: '900765432-1', contacto: 'usuario8 Prueba', telefono: '3209876543' },
    nombre_torneo: 'Copa Empresarial Café Huila', tipo_torneo: 'Comunidad',
    descripcion: 'Torneo anual de la empresa con sus clientes.',
    inicio: 12, fin: 13, franja: ['08:00', '13:00'], canchas: ['Cancha 5'],
    cupo_maximo_parejas: 4, precio_inscripcion: 0, apertura: -3, cierre: 10,
    respuesta: 'Aprobado. Las canchas quedan apartadas para su torneo.',
    participantes: { parejas: [[22, 23]], sueltos: [24, 25] }
  },
  {
    usuario: 9, estado: 'rechazada', modalidad: 'bloque',
    empresa: { nombre: 'Distribuidora El Sol', nit: '800111222-3', contacto: 'usuario9 Prueba', telefono: '3001112233' },
    nombre_torneo: 'Torneo El Sol', tipo_torneo: 'Amateur',
    inicio: 30, fin: 30, franja: ['07:00', '10:00'], canchas: ['Cancha 4'],
    cupo_maximo_parejas: 8, precio_inscripcion: 0, apertura: 3, cierre: 25,
    respuesta: 'En 3 horas de un solo día no caben los partidos de 8 parejas. Envíe otra solicitud con más días o canchas.'
  },
  {
    usuario: 10, estado: 'cancelada', modalidad: 'convenio', convenio_meses: 3,
    empresa: { nombre: 'Gimnasio Fitness Neiva', nit: '', contacto: 'usuario10 Prueba', telefono: '3124445566' },
    nombre_torneo: 'Copa Fitness', tipo_torneo: 'Comunidad',
    inicio: 35, fin: 36, franja: ['14:00', '20:00'], canchas: ['Cancha 2', 'Cancha 5'],
    cupo_maximo_parejas: 8, precio_inscripcion: 20000, apertura: 4, cierre: 30
  }
]

// Descuento (%) por meses de convenio, igual que en libs/solicitudes.js
const DESCUENTO_CONVENIO = { 3: 10, 6: 15, 12: 20 }

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

const aMinutos = (hora) => {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

// Registra resultados al azar ronda por ronda (como lo haría el admin en el
// cuadro): el ganador pasa a la llave siguiente. Los BYE ya vienen resueltos.
const jugarRondas = async (torneoId, hasta) => {
  const partidos = await Partido.find({ torneo_id: torneoId })
  const total = Math.max(0, ...partidos.map(p => p.ronda))
  const limite = hasta === 'todas' ? total : Math.min(hasta, total)
  const llave = new Map(partidos.map(p => [`${p.ronda}-${p.posicion}`, p]))
  for (let ronda = 1; ronda <= limite; ronda++) {
    const deLaRonda = partidos.filter(p => p.ronda === ronda).sort((a, b) => a.posicion - b.posicion)
    for (const p of deLaRonda) {
      if (p.equipo_a == null || p.equipo_b == null || p.ganador != null) continue
      p.ganador = rand() < 0.5 ? p.equipo_a : p.equipo_b
      await p.save()
      const sig = llaveSiguiente(p)
      const siguiente = llave.get(`${sig.ronda}-${sig.posicion}`)
      if (siguiente) {
        siguiente[sig.lado] = p.ganador
        await siguiente.save()
      }
    }
  }
}

// Inscribe participantes en un torneo: parejas mutuas, declaradas y sueltos
const inscribir = async (torneo, { parejas = [], declaradas = [], sueltos = [] }, u, pagado) => {
  const filas = [
    ...parejas.flatMap(([a, b]) => [[a, b], [b, a]]),
    ...declaradas,
    ...sueltos.map(n => [n, null])
  ]
  for (const [i, [n, pareja]] of filas.entries()) {
    const p = await Participante.create({
      torneo_id: torneo._id,
      usuario_id: u(n)._id,
      pareja_usuario_id: pareja ? u(pareja)._id : undefined,
      pago_confirmado: pagado || rand() < 0.4
    })
    // Orden de inscripción escalonado (importa para resolver parejas)
    await fijarFecha(Participante, p._id, 'fecha_inscripcion', new Date(haceDias(20).getTime() + i * 3600000))
  }
  return filas.length
}

// ─── Reset ──────────────────────────────────────────

const reset = async () => {
  const usuarios = await User.find({ email: SEED_EMAIL }).select('_id')
  const ids = usuarios.map(u => u._id)

  // Torneos del script y los creados al aprobar solicitudes de los usuarios de prueba
  const solicitudes = await SolicitudTorneo.find({ solicitante_id: { $in: ids } }).select('torneo_id')
  const torneos = await Torneo.find({
    $or: [
      { nombre: { $in: TORNEOS.map(t => t.nombre) } },
      { _id: { $in: solicitudes.map(s => s.torneo_id).filter(Boolean) } },
      { solicitud_id: { $in: solicitudes.map(s => s._id) } }
    ]
  }).select('_id')
  const canchas = await Cancha.find({ nombre: { $in: CANCHAS.map(c => c.nombre) } })
  const productos = await Producto.find({ nombre: { $in: PRODUCTOS.map(p => p.nombre) } })
  const slides = await Carrusel.find({ titulo: { $in: SLIDES.map(s => s.titulo) } })

  const pedidos = await Pedido.find({ usuario_id: { $in: ids } }).select('_id')
  await PedidoItem.deleteMany({ pedido_id: { $in: pedidos.map(p => p._id) } })
  await Pedido.deleteMany({ _id: { $in: pedidos.map(p => p._id) } })
  await Reserva.deleteMany({ $or: [{ usuario_id: { $in: ids } }, { cancha_id: { $in: canchas.map(c => c._id) } }] })
  await Participante.deleteMany({ $or: [{ usuario_id: { $in: ids } }, { torneo_id: { $in: torneos.map(t => t._id) } }] })
  await SolicitudTorneo.deleteMany({ solicitante_id: { $in: ids } })
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
  const adminPrueba = await User.deleteOne({ email: ADMIN_PRUEBA })
  if (adminPrueba.deletedCount) console.log(`Borrado el admin de prueba ${ADMIN_PRUEBA}`)

  console.log(`Borrados: ${ids.length} usuarios, ${canchas.length} canchas, ${productos.length} productos, ` +
    `${torneos.length} torneos, ${slides.length} slides, ${medias.length} imágenes y sus reservas/pedidos/inscripciones`)
}

// ─── Seed ───────────────────────────────────────────

const seed = async () => {
  if (await User.exists({ email: emailDe(1) })) {
    console.log('Los datos de prueba ya existen. Usa "npm run seed -- --reset" para borrarlos y volver a crearlos.')
    return
  }

  // Se usa el admin existente; si no hay ninguno se crea uno de prueba
  let admin = await User.findOne({ rol: 'admin', activo: true })
  if (!admin) {
    admin = await User.create({
      nombre: 'Admin',
      apellido: 'Prueba',
      email: ADMIN_PRUEBA,
      password_hash: await bcrypt.hash(PASSWORD, 10),
      telefono: '3000000000',
      rol: 'admin',
      activo: true
    })
    console.log(`No había ningún admin: se creó ${ADMIN_PRUEBA} (contraseña ${PASSWORD})`)
  }
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

  const canchaPorNombre = new Map((await Cancha.find()).map(c => [c.nombre, c]))
  const idsCanchas = (nombres = []) => nombres.map(n => canchaPorNombre.get(n)?._id).filter(Boolean)

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
      estado: t.estado,
      inscripcion_apertura: fechaUTC(diaKey(t.apertura)),
      inscripcion_cierre: fechaUTC(diaKey(t.cierre)),
      ...(t.franja && { hora_inicio: t.franja[0], hora_fin: t.franja[1] }),
      duracion_partido_min: t.duracion ?? 90,
      canchas: idsCanchas(t.canchas)
    })
    resumen.torneos++

    const pagado = t.estado === 'en_curso' || t.estado === 'finalizado'
    resumen.participantes += await inscribir(torneo, t, u, pagado)

    if (t.organizar) {
      // Parejas, cuadro y horarios automáticos; luego los resultados ya jugados
      await organizarEquipos(torneo._id)
      if (t.resultados) await jugarRondas(torneo._id, t.resultados)
      if (t.finalSinHorario) {
        const final = await Partido.findOne({ torneo_id: torneo._id }).sort({ ronda: -1 })
        await Partido.updateOne({ _id: final._id }, { fecha: null, hora_inicio: null, hora_fin: null, cancha_id: null })
      }
    }
  }

  // Solicitudes de torneo de empresas
  resumen.solicitudes = 0
  for (const s of SOLICITUDES) {
    const canchasSol = s.canchas.map(n => canchaPorNombre.get(n)).filter(Boolean)
    if (!canchasSol.length) continue

    if (s.conReserva) {
      const r = s.conReserva
      const cancha = canchasSol[0]
      const horas = (aMinutos(r.hora_fin) - aMinutos(r.hora_inicio)) / 60
      await Reserva.create({
        usuario_id: u(r.usuario)._id,
        cancha_id: cancha._id,
        fecha: fechaUTC(diaKey(r.dia)),
        hora_inicio: r.hora_inicio,
        hora_fin: r.hora_fin,
        precio: cancha.precio_por_hora * horas,
        estado: 'confirmada'
      })
    }

    // Misma cotización que libs/solicitudes.js
    const dias = s.fin - s.inicio + 1
    const horasPorDia = (aMinutos(s.franja[1]) - aMinutos(s.franja[0])) / 60
    const valorHora = canchasSol.reduce((suma, c) => suma + c.precio_por_hora, 0)
    const subtotal = Math.round(valorHora * horasPorDia * dias)
    const descuentoPct = s.modalidad === 'convenio' ? DESCUENTO_CONVENIO[s.convenio_meses] ?? 0 : 0
    const descuento = Math.round(subtotal * descuentoPct / 100)

    const solicitud = await SolicitudTorneo.create({
      solicitante_id: u(s.usuario)._id,
      empresa: { ...s.empresa, email: emailDe(s.usuario) },
      nombre_torneo: s.nombre_torneo,
      tipo_torneo: s.tipo_torneo,
      descripcion: s.descripcion ?? '',
      modalidad: s.modalidad,
      convenio_meses: s.convenio_meses ?? null,
      fecha_inicio: fechaUTC(diaKey(s.inicio)),
      fecha_fin: fechaUTC(diaKey(s.fin)),
      hora_inicio: s.franja[0],
      hora_fin: s.franja[1],
      duracion_partido_min: 90,
      canchas: canchasSol.map(c => c._id),
      cupo_maximo_parejas: s.cupo_maximo_parejas,
      precio_inscripcion: s.precio_inscripcion,
      inscripcion_apertura: fechaUTC(diaKey(s.apertura)),
      inscripcion_cierre: fechaUTC(diaKey(s.cierre)),
      costo: {
        dias,
        horas_por_dia: horasPorDia,
        horas_cancha: horasPorDia * dias * canchasSol.length,
        valor_hora: valorHora,
        subtotal,
        descuento_pct: descuentoPct,
        descuento,
        total: subtotal - descuento
      },
      estado: s.estado,
      respuesta_admin: s.respuesta ?? ''
    })
    await fijarFecha(SolicitudTorneo, solicitud._id, 'createdAt', haceDias(entre(1, 6)))
    resumen.solicitudes++

    // Aprobada: se crea el torneo con las canchas apartadas, igual que aprobarSolicitud
    if (s.estado === 'aprobada') {
      const torneo = await Torneo.create({
        nombre: s.nombre_torneo,
        tipo_torneo: s.tipo_torneo,
        fecha_inicio: solicitud.fecha_inicio,
        fecha_fin: solicitud.fecha_fin,
        cupo_maximo_parejas: s.cupo_maximo_parejas,
        precio_inscripcion: s.precio_inscripcion,
        estado: 'activo',
        inscripcion_apertura: solicitud.inscripcion_apertura,
        inscripcion_cierre: solicitud.inscripcion_cierre,
        hora_inicio: s.franja[0],
        hora_fin: s.franja[1],
        duracion_partido_min: 90,
        canchas: solicitud.canchas,
        organizador: s.empresa.nombre,
        solicitud_id: solicitud._id
      })
      // El convenio cuenta desde la aprobación (hoy)
      const vigenteHasta = fechaUTC(diaKey(0))
      if (s.convenio_meses) vigenteHasta.setUTCMonth(vigenteHasta.getUTCMonth() + s.convenio_meses)
      await SolicitudTorneo.updateOne({ _id: solicitud._id }, {
        torneo_id: torneo._id,
        convenio_vigente_hasta: s.convenio_meses ? vigenteHasta : null
      })
      resumen.torneos++
      if (s.participantes) resumen.participantes += await inscribir(torneo, s.participantes, u, false)
    }
  }

  // Reservas: pasadas, futuras y algunas canceladas, sin solapes ni cruces con
  // las canchas apartadas por los torneos
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
    const bloqueos = await bloqueosDeTorneos(cancha._id, fecha)
    if (bloqueos.some(b => b.hora_inicio < fin && b.hora_fin > ini)) continue

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
