import ExcelJS from 'exceljs'
import Torneo from '../models/torneo.model.js'
import Participante from '../models/participante.model.js'
import User from '../models/user.model.js'
import Partido from '../models/partido.model.js'
import { torneoSchema, torneoUpdateSchema, inscripcionSchema, ganadorSchema } from '../schema/torneo.schema.js'
import {
  finalizarTorneosVencidos,
  torneoTerminado,
  contarParejas,
  jugadoresLibres,
  cuposLlenos,
  organizarEquipos,
  cerrarInscripciones as cerrarInscripcionesTorneo,
  limpiarEquipos,
  avisoSinPareja,
  obtenerOrganizacion,
  obtenerCuadro,
  llaveSiguiente
} from '../libs/torneos.js'
import { isAdminRequest } from '../middlewares/auth.middleware.js'

// Usuarios que forman parte de un torneo: inscritos o declarados como pareja de un inscrito
const filtroParticipacion = (torneoId, usuarioId) => ({
  torneo_id: torneoId,
  $or: [{ usuario_id: usuarioId }, { pareja_usuario_id: usuarioId }]
})

// GET /api/torneos
export const getTorneos = async (req, res) => {
  try {
    await finalizarTorneosVencidos()
    const { estado } = req.query
    const filter = estado ? { estado } : {}

    const torneos = await Torneo.find(filter).sort({ fecha_inicio: 1 })

    // Agregar conteo de participantes (jugadores) y de cupos ocupados (parejas)
    const torneosConParticipantes = await Promise.all(
      torneos.map(async (torneo) => {
        const participantes = await Participante.find({ torneo_id: torneo._id })
          .select('usuario_id pareja_usuario_id fecha_inscripcion')
        return {
          ...torneo.toObject(),
          participantes_inscritos: participantes.length,
          parejas_inscritas: contarParejas(participantes),
          jugadores_libres: jugadoresLibres(participantes, torneo.cupo_maximo_parejas)
        }
      })
    )

    return res.status(200).json(torneosConParticipantes)
  } catch (error) {
    console.error('Error en getTorneos:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// GET /api/torneos/:id
export const getTorneoById = async (req, res) => {
  try {
    await finalizarTorneosVencidos()
    const torneo = await Torneo.findById(req.params.id)

    if (!torneo) {
      return res.status(404).json({ message: 'Torneo no encontrado' })
    }

    const esAdmin = isAdminRequest(req)
    const { participantes, equipos, sin_pareja_asignada } = await obtenerOrganizacion(torneo._id)

    const respuesta = {
      ...torneo.toObject(),
      participantes_inscritos: participantes.length,
      parejas_inscritas: contarParejas(participantes),
      jugadores_libres: jugadoresLibres(participantes, torneo.cupo_maximo_parejas)
    }

    // El listado con emails solo lo ve el admin
    if (esAdmin) respuesta.participantes = participantes

    // La organización se publica cuando cierran las inscripciones, y solo
    // para el admin y quienes participan en el torneo
    if (torneo.estado !== 'activo' && req.user) {
      const participa = esAdmin || await Participante.exists(filtroParticipacion(torneo._id, req.user._id))
      if (participa) {
        // Los datos de contacto y de pago solo para el admin
        const publico = ({ email, telefono, pago_confirmado, ...resto }) => resto
        const ver = esAdmin ? (i) => i : publico
        respuesta.organizacion = {
          equipos: equipos.map(e => ({ ...e, integrantes: e.integrantes.map(ver) })),
          sin_pareja_asignada: sin_pareja_asignada.map(ver)
        }
      }
    }

    return res.status(200).json(respuesta)
  } catch (error) {
    console.error('Error en getTorneoById:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// POST /api/torneos — solo admin
export const createTorneo = async (req, res) => {
  try {
    const parsed = torneoSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Datos inválidos',
        errors: parsed.error.issues.map(e => e.message)
      })
    }

    const newTorneo = new Torneo({
      ...parsed.data,
      fecha_inicio: new Date(parsed.data.fecha_inicio),
      fecha_fin: new Date(parsed.data.fecha_fin)
    })

    await newTorneo.save()

    return res.status(201).json({
      message: 'Torneo creado exitosamente',
      torneo: newTorneo
    })
  } catch (error) {
    console.error('Error en createTorneo:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// PUT /api/torneos/:id — solo admin
export const updateTorneo = async (req, res) => {
  try {
    const parsed = torneoUpdateSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Datos inválidos',
        errors: parsed.error.issues.map(e => e.message)
      })
    }

    const data = { ...parsed.data }
    if (data.fecha_inicio) data.fecha_inicio = new Date(data.fecha_inicio)
    if (data.fecha_fin) data.fecha_fin = new Date(data.fecha_fin)

    const actual = await Torneo.findById(req.params.id)
    if (!actual) {
      return res.status(404).json({ message: 'Torneo no encontrado' })
    }

    // El cupo no puede quedar por debajo de las parejas ya inscritas
    if (data.cupo_maximo_parejas !== undefined) {
      const inscritos = await Participante.find({ torneo_id: actual._id })
        .select('usuario_id pareja_usuario_id fecha_inscripcion')
      const ocupadas = contarParejas(inscritos)
      if (data.cupo_maximo_parejas < ocupadas) {
        return res.status(400).json({
          message: `Ya hay ${ocupadas} parejas inscritas; el cupo no puede ser menor`
        })
      }
    }

    // Un torneo que ya terminó no puede quedar activo ni en curso;
    // si se mueve la fecha de fin al futuro sí puede reactivarse
    const estadoFinal = data.estado ?? actual.estado
    const fechaFinFinal = data.fecha_fin ?? actual.fecha_fin
    if (['activo', 'en_curso'].includes(estadoFinal) && torneoTerminado({ fecha_fin: fechaFinFinal })) {
      if (data.estado && data.estado !== actual.estado) {
        return res.status(400).json({
          message: 'No se puede activar ni poner en curso un torneo cuya fecha de fin ya pasó'
        })
      }
      data.estado = 'finalizado'
    }

    const torneo = await Torneo.findByIdAndUpdate(
      req.params.id,
      data,
      { new: true, runValidators: true }
    )

    if (!torneo) {
      return res.status(404).json({ message: 'Torneo no encontrado' })
    }

    // Poner el torneo en curso a mano equivale a cerrar inscripciones: se empareja
    // si venía de 'activo' o si nunca se había organizado
    let aviso = null
    if (torneo.estado === 'en_curso' && actual.estado !== 'en_curso') {
      const organizado = await Participante.exists({ torneo_id: torneo._id, equipo: { $ne: null } })
      if (actual.estado === 'activo' || !organizado) {
        const { sin_pareja } = await organizarEquipos(torneo._id)
        aviso = await avisoSinPareja(sin_pareja)
      }
    }
    // Reabrir inscripciones descarta la organización anterior
    if (torneo.estado === 'activo' && actual.estado !== 'activo') {
      await limpiarEquipos(torneo._id)
    }

    return res.status(200).json({
      message: 'Torneo actualizado exitosamente',
      torneo,
      ...(aviso && { aviso })
    })
  } catch (error) {
    console.error('Error en updateTorneo:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// DELETE /api/torneos/:id — solo admin
export const deleteTorneo = async (req, res) => {
  try {
    const torneo = await Torneo.findByIdAndUpdate(
      req.params.id,
      { estado: 'cancelado' },
      { new: true }
    )

    if (!torneo) {
      return res.status(404).json({ message: 'Torneo no encontrado' })
    }

    return res.status(200).json({ message: 'Torneo cancelado exitosamente' })
  } catch (error) {
    console.error('Error en deleteTorneo:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// POST /api/torneos/:id/inscribir
export const inscribirParticipante = async (req, res) => {
  try {
    await finalizarTorneosVencidos()
    const torneo = await Torneo.findById(req.params.id)

    if (!torneo) {
      return res.status(404).json({ message: 'Torneo no encontrado' })
    }

    if (torneo.estado === 'finalizado' || torneoTerminado(torneo)) {
      return res.status(400).json({ message: 'El torneo ya terminó, no se aceptan más inscripciones' })
    }

    if (torneo.estado === 'en_curso') {
      return res.status(400).json({ message: 'Las inscripciones de este torneo ya están cerradas' })
    }

    if (torneo.estado !== 'activo') {
      return res.status(400).json({ message: 'El torneo no está activo' })
    }

    const parsed = inscripcionSchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Datos inválidos',
        errors: parsed.error.issues.map(e => e.message)
      })
    }
    let parejaId = parsed.data.pareja_usuario_id || null
    const parejaEmail = parsed.data.pareja_email || null

    if (!parejaId && parejaEmail) {
      if (parejaEmail === req.user.email) {
        return res.status(400).json({ message: 'No puedes inscribirte como tu propia pareja' })
      }
      const pareja = await User.findOne({ email: parejaEmail, activo: true }).select('_id')
      if (!pareja) {
        return res.status(404).json({ message: 'No hay ningún usuario registrado con el email de tu pareja' })
      }
      parejaId = pareja._id.toString()
    }

    if (parejaId) {
      if (parejaId === req.user._id.toString()) {
        return res.status(400).json({ message: 'No puedes inscribirte como tu propia pareja' })
      }
      const pareja = await User.exists({ _id: parejaId, activo: true })
      if (!pareja) {
        return res.status(404).json({ message: 'La pareja indicada no existe' })
      }
    }

    // Verificar si ya está inscrito
    const yaInscrito = await Participante.findOne({
      torneo_id: torneo._id,
      usuario_id: req.user._id
    })

    if (yaInscrito) {
      return res.status(409).json({ message: 'Ya estás inscrito en este torneo' })
    }

    const newParticipante = new Participante({
      torneo_id: torneo._id,
      usuario_id: req.user._id,
      pareja_usuario_id: parejaId,
      pago_confirmado: false
    })

    // Verificar cupos (en parejas) contando la inscripción nueva
    const inscritos = await Participante.find({ torneo_id: torneo._id })
      .select('usuario_id pareja_usuario_id fecha_inscripcion')
    const conNuevo = [...inscritos, { ...newParticipante.toObject(), fecha_inscripcion: new Date() }]
    if (contarParejas(conNuevo) > torneo.cupo_maximo_parejas) {
      return res.status(409).json({ message: 'No hay cupos disponibles' })
    }

    await newParticipante.save()

    // Con la última pareja completa se cierran las inscripciones y se empareja
    let cierre = null
    if (cuposLlenos(conNuevo, torneo.cupo_maximo_parejas)) {
      cierre = await cerrarInscripcionesTorneo(torneo._id)
    }
    const aviso = cierre ? await avisoSinPareja(cierre.sin_pareja) : null

    return res.status(201).json({
      message: cierre
        ? 'Inscripción exitosa. Se completaron los cupos y el torneo pasó a en curso'
        : 'Inscripción exitosa',
      participante: cierre ? await Participante.findById(newParticipante._id) : newParticipante,
      inscripciones_cerradas: Boolean(cierre),
      ...(aviso && { aviso })
    })
  } catch (error) {
    console.error('Error en inscribirParticipante:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// PUT /api/torneos/:id/participantes/:participanteId — solo admin: confirma o anula el pago
export const updateParticipante = async (req, res) => {
  try {
    const { pago_confirmado } = req.body
    if (typeof pago_confirmado !== 'boolean') {
      return res.status(400).json({ message: 'pago_confirmado debe ser true o false' })
    }

    const participante = await Participante.findOneAndUpdate(
      { _id: req.params.participanteId, torneo_id: req.params.id },
      { pago_confirmado },
      { new: true }
    )

    if (!participante) {
      return res.status(404).json({ message: 'Inscripción no encontrada' })
    }

    return res.status(200).json({ message: 'Inscripción actualizada', participante })
  } catch (error) {
    console.error('Error en updateParticipante:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// GET /api/torneos/mis-inscripciones
export const getMisInscripciones = async (req, res) => {
  try {
    await finalizarTorneosVencidos()
    const yo = req.user._id.toString()
    const datosUsuario = 'nombre apellido email telefono'

    // Inscripciones propias y aquellas donde otro jugador me declaró como pareja
    const registros = await Participante.find({
      $or: [{ usuario_id: req.user._id }, { pareja_usuario_id: req.user._id }]
    })
      .populate('torneo_id')
      .populate('usuario_id', datosUsuario)
      .populate('pareja_usuario_id', datosUsuario)
      .sort({ fecha_inscripcion: -1 })

    // Un registro por torneo, prefiriendo la inscripción propia
    const porTorneo = new Map()
    for (const r of registros) {
      if (!r.torneo_id) continue // torneo borrado de la base de datos
      const key = r.torneo_id._id.toString()
      const propia = r.usuario_id?._id.toString() === yo
      if (!porTorneo.has(key) || propia) porTorneo.set(key, { r, propia })
    }

    // Compañeros de equipo en los torneos ya organizados
    const conEquipo = [...porTorneo.values()].filter(({ r }) => r.equipo != null)
    const companeros = conEquipo.length
      ? await Participante.find({
        $or: conEquipo.map(({ r }) => ({ torneo_id: r.torneo_id._id, equipo: r.equipo }))
      }).populate('usuario_id', datosUsuario)
      : []

    const contacto = (u) => u
      ? { _id: u._id, nombre: u.nombre, apellido: u.apellido, email: u.email, telefono: u.telefono }
      : null

    const inscripciones = [...porTorneo.values()].map(({ r, propia }) => {
      const torneo = r.torneo_id
      let companero = null
      if (r.equipo != null) {
        if (!propia) {
          companero = r.usuario_id
        } else {
          const otro = companeros.find(c =>
            c.torneo_id.toString() === torneo._id.toString() &&
            c.equipo === r.equipo &&
            c._id.toString() !== r._id.toString()
          )
          // Si la pareja declarada no se inscribió por su cuenta, el compañero es ella
          companero = otro ? otro.usuario_id : r.pareja_usuario_id
        }
      }

      return {
        _id: r._id,
        torneo_id: torneo,
        estado: torneo.estado,
        fecha_inscripcion: r.fecha_inscripcion,
        pago_confirmado: r.pago_confirmado,
        pareja_usuario_id: contacto(propia ? r.pareja_usuario_id : r.usuario_id),
        // true si me inscribió mi pareja y no tengo inscripción propia
        inscrito_por_pareja: !propia,
        equipo: r.equipo,
        companero: contacto(companero),
        sin_pareja_asignada: torneo.estado !== 'activo' && r.equipo == null
      }
    })

    return res.status(200).json(inscripciones)
  } catch (error) {
    console.error('Error en getMisInscripciones:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// DELETE /api/torneos/:id/cancelar-inscripcion
export const cancelarInscripcion = async (req, res) => {
  try {
    // Solo se puede cancelar mientras las inscripciones siguen abiertas
    const torneo = await Torneo.findById(req.params.id)
    if (!torneo) {
      return res.status(404).json({ message: 'Torneo no encontrado' })
    }
    if (torneo.estado === 'en_curso') {
      return res.status(400).json({
        message: 'Las inscripciones ya cerraron y las parejas están organizadas; contacta al administrador'
      })
    }
    if (torneo.estado !== 'activo') {
      return res.status(400).json({ message: 'Solo puedes cancelar la inscripción de un torneo activo' })
    }

    const participante = await Participante.findOneAndDelete({
      torneo_id: req.params.id,
      usuario_id: req.user._id
    })

    if (!participante) {
      return res.status(404).json({ message: 'Inscripción no encontrada' })
    }

    return res.status(200).json({ message: 'Inscripción cancelada exitosamente' })
  } catch (error) {
    console.error('Error en cancelarInscripcion:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// PUT /api/torneos/:id/cerrar-inscripciones — solo admin
export const cerrarInscripciones = async (req, res) => {
  try {
    await finalizarTorneosVencidos()
    const actual = await Torneo.findById(req.params.id)
    if (!actual) {
      return res.status(404).json({ message: 'Torneo no encontrado' })
    }
    if (actual.estado !== 'activo') {
      return res.status(400).json({ message: 'Solo se pueden cerrar las inscripciones de un torneo activo' })
    }

    const cierre = await cerrarInscripcionesTorneo(actual._id)
    if (!cierre) {
      return res.status(409).json({ message: 'El torneo ya cambió de estado, recarga la página' })
    }

    const aviso = await avisoSinPareja(cierre.sin_pareja)
    const { equipos, sin_pareja_asignada } = await obtenerOrganizacion(cierre.torneo._id)

    return res.status(200).json({
      message: 'Inscripciones cerradas y parejas organizadas',
      torneo: cierre.torneo,
      organizacion: { equipos, sin_pareja_asignada },
      ...(aviso && { aviso })
    })
  } catch (error) {
    console.error('Error en cerrarInscripciones:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// PUT /api/torneos/:id/reorganizar — solo admin: vuelve a emparejar al azar a los sueltos
export const reorganizarTorneo = async (req, res) => {
  try {
    await finalizarTorneosVencidos()
    const torneo = await Torneo.findById(req.params.id)
    if (!torneo) {
      return res.status(404).json({ message: 'Torneo no encontrado' })
    }
    if (torneo.estado !== 'en_curso') {
      return res.status(400).json({ message: 'Solo se puede reorganizar un torneo en curso' })
    }

    const { sin_pareja } = await organizarEquipos(torneo._id)
    const aviso = await avisoSinPareja(sin_pareja)
    const { equipos, sin_pareja_asignada } = await obtenerOrganizacion(torneo._id)

    return res.status(200).json({
      message: 'Parejas reorganizadas',
      organizacion: { equipos, sin_pareja_asignada },
      ...(aviso && { aviso })
    })
  } catch (error) {
    console.error('Error en reorganizarTorneo:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// GET /api/torneos/:id/exportar — solo admin: .xlsx con equipos y participantes
export const exportarTorneo = async (req, res) => {
  try {
    const torneo = await Torneo.findById(req.params.id)
    if (!torneo) {
      return res.status(404).json({ message: 'Torneo no encontrado' })
    }

    const { participantes, equipos, sin_pareja_asignada } = await obtenerOrganizacion(torneo._id)
    // Mientras está activo no hay organización: equipo vacío en vez de "Sin pareja"
    const organizado = torneo.estado !== 'activo'

    const libro = new ExcelJS.Workbook()
    libro.creator = 'PadelZone'
    libro.created = new Date()

    const hojaEquipos = libro.addWorksheet('Equipos')
    hojaEquipos.columns = [
      { header: 'Equipo', key: 'equipo', width: 12 },
      { header: 'Integrante 1', key: 'integrante1', width: 28 },
      { header: 'Integrante 2', key: 'integrante2', width: 28 },
      { header: 'Emails', key: 'emails', width: 44 },
      { header: 'Teléfonos', key: 'telefonos', width: 28 }
    ]
    const unir = (lista, campo) => lista.map(i => i[campo]).filter(Boolean).join(' / ')
    for (const { equipo, integrantes } of equipos) {
      hojaEquipos.addRow({
        equipo,
        integrante1: integrantes[0]?.nombre ?? '',
        integrante2: integrantes[1]?.nombre ?? '',
        emails: unir(integrantes, 'email'),
        telefonos: unir(integrantes, 'telefono')
      })
    }
    if (organizado) {
      for (const i of sin_pareja_asignada) {
        hojaEquipos.addRow({
          equipo: 'Sin pareja',
          integrante1: i.nombre,
          integrante2: '',
          emails: i.email,
          telefonos: i.telefono
        })
      }
    }

    const hojaParticipantes = libro.addWorksheet('Participantes')
    hojaParticipantes.columns = [
      { header: 'Nombre', key: 'nombre', width: 28 },
      { header: 'Email', key: 'email', width: 32 },
      { header: 'Teléfono', key: 'telefono', width: 18 },
      { header: 'Equipo', key: 'equipo', width: 12 },
      { header: 'Pago confirmado', key: 'pago', width: 18 }
    ]
    for (const p of participantes) {
      const u = p.usuario_id
      hojaParticipantes.addRow({
        nombre: u ? `${u.nombre} ${u.apellido}` : 'Usuario eliminado',
        email: u?.email ?? '',
        telefono: u?.telefono ?? '',
        equipo: p.equipo ?? (organizado ? 'Sin pareja' : ''),
        pago: p.pago_confirmado ? 'Sí' : 'No'
      })
    }

    for (const hoja of [hojaEquipos, hojaParticipantes]) {
      hoja.getRow(1).font = { bold: true }
      hoja.views = [{ state: 'frozen', ySplit: 1 }]
    }

    // Nombre de archivo sin tildes ni caracteres raros para el header
    const base = torneo.nombre.normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'torneo'

    const buffer = await libro.xlsx.writeBuffer()
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${base}.xlsx"`)
    return res.status(200).send(Buffer.from(buffer))
  } catch (error) {
    console.error('Error en exportarTorneo:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// GET /api/torneos/:id/cuadro — solo el admin y quienes participan en el torneo
export const getCuadro = async (req, res) => {
  try {
    await finalizarTorneosVencidos()
    const torneo = await Torneo.findById(req.params.id)
    if (!torneo) {
      return res.status(404).json({ message: 'Torneo no encontrado' })
    }

    const participa = isAdminRequest(req) ||
      await Participante.exists(filtroParticipacion(torneo._id, req.user._id))
    if (!participa) {
      return res.status(403).json({ message: 'Solo los participantes del torneo pueden ver el cuadro' })
    }

    const base = { torneo_id: torneo._id, nombre: torneo.nombre, estado: torneo.estado }

    // Mientras las inscripciones sigan abiertas no hay parejas ni cuadro
    if (torneo.estado === 'activo') {
      return res.status(200).json({
        ...base,
        publicado: false,
        message: 'El cuadro se publicará al cerrar las inscripciones'
      })
    }

    const cuadro = await obtenerCuadro(torneo._id, req.user._id)
    return res.status(200).json({ ...base, publicado: true, ...cuadro })
  } catch (error) {
    console.error('Error en getCuadro:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}

// PUT /api/torneos/:id/partidos/:partidoId — solo admin: marca (o quita) el ganador
// y lo pasa a la llave de la ronda siguiente
export const setGanadorPartido = async (req, res) => {
  try {
    const parsed = ganadorSchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Datos inválidos',
        errors: parsed.error.issues.map(e => e.message)
      })
    }
    const { ganador } = parsed.data

    const torneo = await Torneo.findById(req.params.id)
    if (!torneo) {
      return res.status(404).json({ message: 'Torneo no encontrado' })
    }
    if (!['en_curso', 'finalizado'].includes(torneo.estado)) {
      return res.status(400).json({ message: 'Solo se registran resultados de torneos en curso o finalizados' })
    }

    const partido = await Partido.findOne({ _id: req.params.partidoId, torneo_id: torneo._id })
    if (!partido) {
      return res.status(404).json({ message: 'Partido no encontrado' })
    }
    if (partido.equipo_a == null || partido.equipo_b == null) {
      return res.status(400).json({ message: 'Este partido aún no tiene definidas las dos parejas' })
    }
    if (ganador != null && ganador !== partido.equipo_a && ganador !== partido.equipo_b) {
      return res.status(400).json({ message: 'El ganador debe ser una de las dos parejas del partido' })
    }

    // Si la pareja ya jugó la ronda siguiente, cambiar este resultado dejaría el cuadro incoherente
    const sig = llaveSiguiente(partido)
    const siguiente = await Partido.findOne({ torneo_id: torneo._id, ronda: sig.ronda, posicion: sig.posicion })
    if (siguiente?.ganador != null && ganador !== partido.ganador) {
      return res.status(409).json({
        message: 'El partido siguiente ya tiene ganador; quita primero ese resultado'
      })
    }

    partido.ganador = ganador
    await partido.save()
    if (siguiente) {
      siguiente[sig.lado] = ganador
      await siguiente.save()
    }

    const cuadro = await obtenerCuadro(torneo._id, req.user._id)
    return res.status(200).json({
      message: ganador == null ? 'Resultado eliminado' : 'Ganador registrado',
      cuadro: { torneo_id: torneo._id, nombre: torneo.nombre, estado: torneo.estado, publicado: true, ...cuadro }
    })
  } catch (error) {
    console.error('Error en setGanadorPartido:', error)
    return res.status(500).json({ message: 'Error interno del servidor' })
  }
}
