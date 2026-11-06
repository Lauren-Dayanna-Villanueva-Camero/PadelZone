import Torneo from '../models/torneo.model.js'
import Participante from '../models/participante.model.js'
import Partido from '../models/partido.model.js'
import Cancha from '../models/cancha.model.js'
import { diasEntre, turnosDelDia } from './horarios.js'

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

// Fase de inscripciones de un torneo: 'proximamente' (aún no abren),
// 'abiertas' o 'cerradas'. El día de apertura y el de cierre cuentan completos.
export const faseInscripcion = (torneo, hoy = inicioDeHoy()) => {
  if (torneo.estado !== 'activo' || torneoTerminado(torneo)) return 'cerradas'
  if (torneo.inscripcion_apertura && hoy < new Date(torneo.inscripcion_apertura)) return 'proximamente'
  if (torneo.inscripcion_cierre && hoy > new Date(torneo.inscripcion_cierre)) return 'cerradas'
  return 'abiertas'
}

// Cierra (empareja y sortea el cuadro) los torneos activos cuya fecha de cierre
// de inscripciones ya pasó. Igual que finalizarTorneosVencidos, se llama antes de
// leer o inscribir en vez de usar un proceso programado.
export const cerrarInscripcionesVencidas = async () => {
  const vencidos = await Torneo.find({
    estado: 'activo',
    inscripcion_cierre: { $ne: null, $lt: inicioDeHoy() }
  }).select('_id')
  for (const t of vencidos) await cerrarInscripciones(t._id)
}

// Pone al día los estados: primero finaliza los vencidos (no tiene sentido
// emparejar un torneo que ya terminó) y luego cierra inscripciones vencidas
export const actualizarEstadosTorneos = async () => {
  await finalizarTorneosVencidos()
  await cerrarInscripcionesVencidas()
}

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

  // Con parejas nuevas el cuadro anterior deja de valer (cerrar inscripciones,
  // reorganizar o poner en curso a mano pasan por aquí)
  await generarCuadro(torneoId)

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
export const limpiarEquipos = async (torneoId) => {
  await Participante.updateMany({ torneo_id: torneoId }, { equipo: null })
  await Partido.deleteMany({ torneo_id: torneoId })
}

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

// ─── Cuadro de eliminación ──────────────────────────

// Orden clásico de siembra: en un cuadro de 8 → [1, 8, 4, 5, 2, 7, 3, 6].
// Cada par consecutivo es una llave; la semilla 1 y la 2 solo se cruzan en la final.
const ordenSemillas = (tamano) => {
  let orden = [1]
  while (orden.length < tamano) {
    const total = orden.length * 2 + 1
    orden = orden.flatMap(s => [s, total - s])
  }
  return orden
}

const nombresRonda = ['Final', 'Semifinal', 'Cuartos', 'Octavos', 'Dieciseisavos']
export const nombreRonda = (ronda, totalRondas) =>
  nombresRonda[totalRondas - ronda] ?? `Ronda ${ronda}`

// Llave de la ronda siguiente a la que pasa el ganador de un partido
export const llaveSiguiente = ({ ronda, posicion }) => ({
  ronda: ronda + 1,
  posicion: Math.floor(posicion / 2),
  lado: posicion % 2 === 0 ? 'equipo_a' : 'equipo_b'
})

// Arma el cuadro desde cero con las parejas organizadas (borra resultados previos).
// El tamaño es la siguiente potencia de 2; las semillas que sobran son BYE y, por
// el orden de siembra, nunca caen dos BYE en la misma llave. El sorteo es al azar.
export const generarCuadro = async (torneoId) => {
  await Partido.deleteMany({ torneo_id: torneoId })
  const numeros = await Participante.distinct('equipo', { torneo_id: torneoId, equipo: { $ne: null } })
  if (numeros.length < 2) return []

  const tamano = 2 ** Math.ceil(Math.log2(numeros.length))
  const totalRondas = Math.log2(tamano)
  const sorteados = mezclar(numeros)
  const semillas = ordenSemillas(tamano)

  const partidos = new Map()
  const clave = (ronda, posicion) => `${ronda}-${posicion}`
  for (let ronda = 1; ronda <= totalRondas; ronda++) {
    for (let posicion = 0; posicion < tamano / 2 ** ronda; posicion++) {
      partidos.set(clave(ronda, posicion), {
        torneo_id: torneoId, ronda, posicion, equipo_a: null, equipo_b: null, ganador: null
      })
    }
  }

  // Primera ronda; quien enfrenta un BYE gana directo y pasa a la siguiente
  for (let posicion = 0; posicion < tamano / 2; posicion++) {
    const partido = partidos.get(clave(1, posicion))
    partido.equipo_a = sorteados[semillas[posicion * 2] - 1] ?? null
    partido.equipo_b = sorteados[semillas[posicion * 2 + 1] - 1] ?? null
    if (partido.equipo_a == null || partido.equipo_b == null) {
      partido.ganador = partido.equipo_a ?? partido.equipo_b
      const sig = llaveSiguiente(partido)
      partidos.get(clave(sig.ronda, sig.posicion))[sig.lado] = partido.ganador
    }
  }

  const torneo = await Torneo.findById(torneoId)
  await programarPartidos(torneo, [...partidos.values()])

  return Partido.insertMany([...partidos.values()])
}

// ─── Horarios de los partidos ───────────────────────

// Asigna fecha, hora y cancha a cada partido que se juega (los BYE de la primera
// ronda no se juegan). Los turnos salen de los días del torneo, su franja diaria
// y la duración de un partido; en cada turno se juega un partido por cancha.
// Las rondas se reparten en los días (la primera el primer día y la final el
// último) y una ronda empieza siempre en un turno posterior a la anterior.
// Si no alcanzan los turnos, los partidos que sobran quedan sin horario.
export const programarPartidos = async (torneo, partidos) => {
  for (const p of partidos) Object.assign(p, { fecha: null, hora_inicio: null, hora_fin: null, cancha_id: null })
  if (!torneo || !partidos.length) return partidos

  const canchas = torneo.canchas?.length
    ? torneo.canchas.map(c => c._id ?? c)
    : (await Cancha.find({ activa: true }).sort({ nombre: 1 }).select('_id')).map(c => c._id)
  const porTurno = Math.max(canchas.length, 1)

  const dias = diasEntre(torneo.fecha_inicio, torneo.fecha_fin)
  const turnos = turnosDelDia(torneo.hora_inicio || '08:00', torneo.hora_fin || '20:00', torneo.duracion_partido_min || 90)
  const filas = dias.flatMap((fecha, dia) => turnos.map(t => ({ dia, fecha, ...t })))
  if (!filas.length) return partidos

  const totalRondas = Math.max(...partidos.map(p => p.ronda))
  let fila = 0
  for (let ronda = 1; ronda <= totalRondas; ronda++) {
    const diaIdeal = totalRondas > 1 ? Math.round((ronda - 1) * (dias.length - 1) / (totalRondas - 1)) : 0
    const primeraDelDia = filas.findIndex(f => f.dia === diaIdeal)
    fila = Math.max(fila, primeraDelDia)

    const porJugar = partidos
      .filter(p => p.ronda === ronda && !(ronda === 1 && (p.equipo_a == null || p.equipo_b == null)))
      .sort((a, b) => a.posicion - b.posicion)

    let usados = 0
    for (const p of porJugar) {
      const turno = filas[fila + Math.floor(usados / porTurno)]
      if (!turno) break
      p.fecha = turno.fecha
      p.hora_inicio = turno.hora_inicio
      p.hora_fin = turno.hora_fin
      p.cancha_id = canchas[usados % porTurno] ?? null
      usados++
    }
    fila += Math.ceil(usados / porTurno)
  }
  return partidos
}

// Vuelve a calcular los horarios de un cuadro ya armado sin tocar los resultados
// (por ejemplo, si el admin cambió los días, la franja o las canchas del torneo)
export const reprogramarPartidos = async (torneoId) => {
  const torneo = await Torneo.findById(torneoId)
  const partidos = await Partido.find({ torneo_id: torneoId })
  if (!partidos.length) return 0
  const planos = partidos.map(p => ({ _id: p._id, ronda: p.ronda, posicion: p.posicion, equipo_a: p.equipo_a, equipo_b: p.equipo_b }))
  await programarPartidos(torneo, planos)
  await Partido.bulkWrite(planos.map(p => ({
    updateOne: {
      filter: { _id: p._id },
      update: { fecha: p.fecha, hora_inicio: p.hora_inicio, hora_fin: p.hora_fin, cancha_id: p.cancha_id }
    }
  })))
  return partidos.length
}

const horarioDe = (p) => p.fecha
  ? {
      fecha: p.fecha,
      hora_inicio: p.hora_inicio,
      hora_fin: p.hora_fin,
      cancha: p.cancha_id ? { _id: p.cancha_id._id ?? p.cancha_id, nombre: p.cancha_id.nombre ?? 'Cancha' } : null
    }
  : null

// Cuadro listo para mostrar: solo números de pareja y nombres de los jugadores
// (sin email, teléfono ni pagos). mi_equipo es la pareja de quien consulta.
export const obtenerCuadro = async (torneoId, usuarioId) => {
  const buscar = () => Partido.find({ torneo_id: torneoId })
    .populate('cancha_id', 'nombre')
    .sort({ ronda: 1, posicion: 1 })
  let partidos = await buscar()
  const { equipos } = await obtenerOrganizacion(torneoId)

  // Torneos organizados antes de que existiera el cuadro
  if (!partidos.length && equipos.length >= 2) {
    await generarCuadro(torneoId)
    partidos = await buscar()
  }

  const nombres = new Map(equipos.map(e => [e.equipo, e.integrantes.map(i => i.nombre)]))
  const yo = usuarioId?.toString()
  const mio = equipos.find(e => e.integrantes.some(i => i.usuario_id?.toString() === yo))

  // En la primera ronda un hueco es un BYE; en las demás, una llave por definir
  const casilla = (numero, ronda) => numero == null
    ? (ronda === 1 ? { bye: true } : null)
    : { equipo: numero, nombres: nombres.get(numero) ?? [] }

  const totalRondas = partidos.reduce((max, p) => Math.max(max, p.ronda), 0)
  const rondas = []
  for (let ronda = 1; ronda <= totalRondas; ronda++) {
    rondas.push({
      ronda,
      nombre: nombreRonda(ronda, totalRondas),
      partidos: partidos.filter(p => p.ronda === ronda).map(p => ({
        _id: p._id,
        ronda: p.ronda,
        posicion: p.posicion,
        equipo_a: casilla(p.equipo_a, ronda),
        equipo_b: casilla(p.equipo_b, ronda),
        ganador: p.ganador,
        horario: horarioDe(p)
      }))
    })
  }

  const final = rondas.at(-1)?.partidos[0]
  return {
    rondas,
    campeon: final?.ganador != null ? casilla(final.ganador, totalRondas) : null,
    mi_equipo: mio?.equipo ?? null
  }
}

// Partidos de un usuario en todos sus torneos organizados, en orden cronológico
// (los que no tienen horario van al final). No incluye los BYE.
export const obtenerMisPartidos = async (usuarioId) => {
  const registros = await Participante.find({
    $or: [{ usuario_id: usuarioId }, { pareja_usuario_id: usuarioId }],
    equipo: { $ne: null }
  }).populate('torneo_id', 'nombre estado tipo_torneo')

  const torneos = new Map()
  for (const r of registros) {
    if (r.torneo_id && ['en_curso', 'finalizado'].includes(r.torneo_id.estado)) {
      torneos.set(r.torneo_id._id.toString(), r.torneo_id)
    }
  }

  const lista = []
  for (const torneo of torneos.values()) {
    const { rondas, mi_equipo: mio } = await obtenerCuadro(torneo._id, usuarioId)
    if (mio == null) continue
    for (const ronda of rondas) {
      for (const p of ronda.partidos) {
        const lado = p.equipo_a?.equipo === mio ? 'equipo_a' : p.equipo_b?.equipo === mio ? 'equipo_b' : null
        if (!lado) continue
        const rival = lado === 'equipo_a' ? p.equipo_b : p.equipo_a
        if (rival?.bye) continue
        lista.push({
          partido_id: p._id,
          torneo: { _id: torneo._id, nombre: torneo.nombre, estado: torneo.estado, tipo_torneo: torneo.tipo_torneo },
          ronda: ronda.nombre,
          horario: p.horario,
          mi_equipo: mio,
          rival: rival ? { equipo: rival.equipo, nombres: rival.nombres } : null,
          resultado: p.ganador == null ? 'pendiente' : p.ganador === mio ? 'ganado' : 'perdido'
        })
      }
    }
  }

  const orden = (x) => x.horario ? `${new Date(x.horario.fecha).toISOString().slice(0, 10)} ${x.horario.hora_inicio}` : '9999'
  return lista.sort((a, b) => orden(a).localeCompare(orden(b)))
}
