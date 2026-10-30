import Torneo from '../models/torneo.model.js'
import Participante from '../models/participante.model.js'

// Las fechas de los torneos se guardan como medianoche UTC del día elegido
// ('2026-10-22' → 2026-10-22T00:00:00Z). Para comparar se toma el día local
// del servidor y se lleva al mismo formato.
export const inicioDeHoy = () => {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return new Date(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00.000Z`)
}

// Un torneo termina cuando ya pasó su último día (fecha_fin incluida)
export const torneoTerminado = (torneo) => new Date(torneo.fecha_fin) < inicioDeHoy()

// Pasa a 'finalizado' los torneos activos o en curso cuya fecha de fin ya pasó.
// Se llama antes de leer o inscribir, así no hace falta un proceso programado.
export const finalizarTorneosVencidos = () =>
  Torneo.updateMany(
    { estado: { $in: ['activo', 'en_curso'] }, fecha_fin: { $lt: inicioDeHoy() } },
    { estado: 'finalizado' }
  )

// ─── Emparejamiento ─────────────────────────────────

// Acepta un ObjectId o un documento populado
const idDe = (v) => (v?._id ?? v)?.toString() ?? null

const parejaDeclarada = (p) => {
  const pareja = idDe(p.pareja_usuario_id)
  return pareja && pareja !== idDe(p.usuario_id) ? pareja : null
}

// Separa las parejas ya declaradas de los participantes sueltos.
// - Si A declara a B y B declara a A (o B no declaró a nadie), forman una sola pareja.
// - Si A declara a B y B no se inscribió, la pareja es A + B (B sin inscripción propia).
// - Si hay conflicto (B ya está en otra pareja, o declaró a otra persona), A queda suelto.
// Ante empates gana el que se inscribió primero.
export const resolverParejas = (participantes) => {
  const ordenados = [...participantes].sort((a, b) => a.fecha_inscripcion - b.fecha_inscripcion)
  const porUsuario = new Map(ordenados.map(p => [idDe(p.usuario_id), p]))
  const usados = new Set()
  const parejas = []

  // 1) Parejas mutuas
  for (const p of ordenados) {
    const yo = idDe(p.usuario_id)
    const otro = parejaDeclarada(p)
    if (!otro || usados.has(yo) || usados.has(otro)) continue
    const q = porUsuario.get(otro)
    if (q && parejaDeclarada(q) === yo) {
      parejas.push([p, q])
      usados.add(yo).add(otro)
    }
  }

  // 2) Declaradas por un solo lado
  for (const p of ordenados) {
    const yo = idDe(p.usuario_id)
    const otro = parejaDeclarada(p)
    if (!otro || usados.has(yo) || usados.has(otro)) continue
    const q = porUsuario.get(otro)
    if (!q) parejas.push([p])
    else if (!parejaDeclarada(q)) parejas.push([p, q])
    else continue
    usados.add(yo).add(otro)
  }

  const sueltos = ordenados.filter(p => !usados.has(idDe(p.usuario_id)))
  return { parejas, sueltos }
}

// Cupos ocupados (en parejas): los sueltos cuentan como media pareja
export const contarParejas = (participantes) => {
  const { parejas, sueltos } = resolverParejas(participantes)
  return parejas.length + Math.ceil(sueltos.length / 2)
}

// Plazas libres contadas en jugadores: un suelto deja media pareja libre que
// puede ocupar otro jugador sin pareja (contarParejas redondea hacia arriba)
export const jugadoresLibres = (participantes, cupo) => {
  const { parejas, sueltos } = resolverParejas(participantes)
  return Math.max(cupo * 2 - parejas.length * 2 - sueltos.length, 0)
}

// El torneo está lleno cuando todas las parejas del cupo están completas
export const cuposLlenos = (participantes, cupo) => {
  const { parejas, sueltos } = resolverParejas(participantes)
  return parejas.length + sueltos.length / 2 >= cupo
}

const mezclar = (lista) => {
  const copia = [...lista]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}

// Asigna el número de equipo a cada participante: primero las parejas declaradas,
// luego los sueltos mezclados al azar de a dos. Si queda uno impar se deja con
// equipo null (sin pareja asignada).
export const organizarEquipos = async (torneoId) => {
  const participantes = await Participante.find({ torneo_id: torneoId })
  const { parejas, sueltos } = resolverParejas(participantes)

  const mezclados = mezclar(sueltos)
  const equipos = [...parejas]
  for (let i = 0; i + 1 < mezclados.length; i += 2) {
    equipos.push([mezclados[i], mezclados[i + 1]])
  }
  const sinPareja = mezclados.length % 2 ? mezclados[mezclados.length - 1] : null

  const asignado = new Map()
  equipos.forEach((miembros, i) => miembros.forEach(p => asignado.set(p._id.toString(), i + 1)))

  if (participantes.length) {
    await Participante.bulkWrite(participantes.map(p => ({
      updateOne: {
        filter: { _id: p._id },
        update: { equipo: asignado.get(p._id.toString()) ?? null }
      }
    })))
  }

  return { total_equipos: equipos.length, sin_pareja: sinPareja }
}

// Pasa el torneo de 'activo' a 'en_curso' y lo organiza. Es atómico: si dos
// peticiones intentan cerrarlo a la vez, solo una lo empareja.
// Devuelve null si el torneo no estaba activo.
export const cerrarInscripciones = async (torneoId) => {
  const torneo = await Torneo.findOneAndUpdate(
    { _id: torneoId, estado: 'activo' },
    { estado: 'en_curso' },
    { new: true }
  )
  if (!torneo) return null
  const resultado = await organizarEquipos(torneo._id)
  return { torneo, ...resultado }
}

// Al volver a abrir inscripciones la organización anterior deja de valer
export const limpiarEquipos = (torneoId) =>
  Participante.updateMany({ torneo_id: torneoId }, { equipo: null })

// Mensaje para la respuesta cuando alguien quedó sin pareja
export const avisoSinPareja = async (sinPareja) => {
  if (!sinPareja) return null
  const p = await sinPareja.populate('usuario_id', 'nombre apellido')
  const nombre = p.usuario_id ? `${p.usuario_id.nombre} ${p.usuario_id.apellido}` : 'Un participante'
  return `${nombre} quedó sin pareja asignada (número impar de participantes sueltos)`
}

const integrante = (usuario, participante) => ({
  usuario_id: usuario?._id ?? null,
  nombre: usuario ? `${usuario.nombre} ${usuario.apellido}` : 'Usuario eliminado',
  email: usuario?.email ?? '',
  telefono: usuario?.telefono ?? '',
  inscrito: Boolean(participante),
  participante_id: participante?._id ?? null,
  pago_confirmado: participante?.pago_confirmado ?? false
})

// Equipos con sus integrantes, a partir del número de equipo guardado
export const obtenerOrganizacion = async (torneoId) => {
  const participantes = await Participante.find({ torneo_id: torneoId })
    .populate('usuario_id', 'nombre apellido email telefono')
    .populate('pareja_usuario_id', 'nombre apellido email telefono')
    .sort({ equipo: 1, fecha_inscripcion: 1 })

  const porEquipo = new Map()
  const sinPareja = []
  for (const p of participantes) {
    if (p.equipo == null) {
      sinPareja.push(p)
      continue
    }
    if (!porEquipo.has(p.equipo)) porEquipo.set(p.equipo, [])
    porEquipo.get(p.equipo).push(p)
  }

  const equipos = [...porEquipo].map(([equipo, miembros]) => {
    const integrantes = miembros.map(m => integrante(m.usuario_id, m))
    // Pareja declarada que no se inscribió por su cuenta
    if (miembros.length === 1 && miembros[0].pareja_usuario_id) {
      integrantes.push(integrante(miembros[0].pareja_usuario_id, null))
    }
    return { equipo, integrantes }
  })

  return {
    participantes,
    equipos,
    sin_pareja_asignada: sinPareja.map(p => integrante(p.usuario_id, p))
  }
}
