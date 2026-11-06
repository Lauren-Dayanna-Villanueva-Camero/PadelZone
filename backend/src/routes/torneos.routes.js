import { Router } from 'express'
import {
  getTorneos,
  getTorneoById,
  createTorneo,
  updateTorneo,
  deleteTorneo,
  inscribirParticipante,
  cancelarInscripcion,
  getMisInscripciones,
  updateParticipante,
  cerrarInscripciones,
  reorganizarTorneo,
  exportarTorneo,
  getCuadro,
  setGanadorPartido,
  setHorarioPartido,
  reprogramarHorarios,
  getMisPartidos
} from '../controllers/torneos.controller.js'
import { authRequired, adminRequired, optionalAuth } from '../middlewares/auth.middleware.js'
import { validateId } from '../middlewares/validate.middleware.js'

const router = Router()

// Las rutas fijas de un solo segmento deben ir antes de '/:id'; si no, Express
// tomaría 'mis-inscripciones' como un id (y validateId respondería 400)
router.get('/mis-inscripciones', authRequired, getMisInscripciones)
router.get('/mis-partidos', authRequired, getMisPartidos)

// Rutas públicas (con sesión opcional: el admin y los participantes ven más datos)
router.get('/', getTorneos)
router.get('/:id', validateId(), optionalAuth, getTorneoById)

// Rutas solo admin
router.post('/', authRequired, adminRequired, createTorneo)
router.put('/:id', validateId(), authRequired, adminRequired, updateTorneo)
router.delete('/:id', validateId(), authRequired, adminRequired, deleteTorneo)
router.put('/:id/cerrar-inscripciones', validateId(), authRequired, adminRequired, cerrarInscripciones)
router.put('/:id/reorganizar', validateId(), authRequired, adminRequired, reorganizarTorneo)
router.get('/:id/exportar', validateId(), authRequired, adminRequired, exportarTorneo)
router.put('/:id/partidos/:partidoId', validateId(), validateId('partidoId'), authRequired, adminRequired, setGanadorPartido)
router.put('/:id/partidos/:partidoId/horario', validateId(), validateId('partidoId'), authRequired, adminRequired, setHorarioPartido)
router.put('/:id/reprogramar', validateId(), authRequired, adminRequired, reprogramarHorarios)
router.put('/:id/participantes/:participanteId', validateId(), validateId('participanteId'), authRequired, adminRequired, updateParticipante)

// Rutas usuario autenticado
// El cuadro exige sesión: el controller comprueba que sea admin o participante
router.get('/:id/cuadro', validateId(), authRequired, getCuadro)
router.post('/:id/inscribir', validateId(), authRequired, inscribirParticipante)
router.delete('/:id/cancelar-inscripcion', validateId(), authRequired, cancelarInscripcion)

export default router
