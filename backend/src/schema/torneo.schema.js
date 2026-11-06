import { z } from 'zod'
import { objectId } from './common.js'

const fecha = (message) => z.string().regex(/^\d{4}-\d{2}-\d{2}/, message)
export const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato de hora inválido (HH:mm)')

// Sin .default(): ver nota en cancha.schema.js
const torneoBase = z.object({
  nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
  tipo_torneo: z.enum(['Amateur', 'Profesional', 'Comunidad'], {
    error: 'Tipo de torneo inválido'
  }),
  fecha_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'La fecha de inicio es requerida'),
  fecha_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'La fecha de fin es requerida'),
  cupo_maximo_parejas: z.number().int().min(1, 'El cupo mínimo es 1'),
  precio_inscripcion: z.number().min(0, 'El precio no puede ser negativo'),
  estado: z.enum(['activo', 'en_curso', 'finalizado', 'cancelado'], {
    error: 'Estado de torneo inválido'
  }).optional(),
  // Periodo de inscripciones y programación de partidos (la coherencia entre
  // fechas se revisa en el controller con errorProgramacion)
  inscripcion_apertura: fecha('La fecha de apertura de inscripciones no es válida').nullable().optional(),
  inscripcion_cierre: fecha('La fecha de cierre de inscripciones no es válida').nullable().optional(),
  hora_inicio: hora.optional(),
  hora_fin: hora.optional(),
  duracion_partido_min: z.number().int().min(30, 'Un partido dura al menos 30 minutos')
    .max(180, 'Un partido dura como máximo 180 minutos').optional(),
  canchas: z.array(objectId('Cancha inválida')).optional(),
  organizador: z.string().trim().max(120, 'El organizador es demasiado largo').optional()
})

const fechasEnOrden = (d) => !d.fecha_inicio || !d.fecha_fin || d.fecha_fin >= d.fecha_inicio
const fechasError = { message: 'La fecha de fin no puede ser anterior a la de inicio', path: ['fecha_fin'] }

export const torneoSchema = torneoBase.refine(fechasEnOrden, fechasError)
export const torneoUpdateSchema = torneoBase.partial().refine(fechasEnOrden, fechasError)

// La pareja se indica por id o por email (lo que usa el formulario público)
export const inscripcionSchema = z.object({
  pareja_usuario_id: objectId('Pareja inválida').nullable().optional(),
  pareja_email: z.union([
    z.literal(''),
    z.string().trim().toLowerCase().email('El email de la pareja no es válido')
  ]).nullable().optional()
})

// Ganador de un partido del cuadro: número de pareja, o null para quitarlo
export const ganadorSchema = z.object({
  ganador: z.number({ error: 'El ganador debe ser un número de pareja' })
    .int('El ganador debe ser un número de pareja').min(1, 'El ganador debe ser un número de pareja')
    .nullable()
})

// Horario de un partido del cuadro (el admin lo ajusta a mano). Todo null = por definir
export const horarioPartidoSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)').nullable(),
  hora_inicio: hora.nullable(),
  cancha_id: objectId('Cancha inválida').nullable().optional()
}).refine(d => (d.fecha == null) === (d.hora_inicio == null), {
  message: 'Indica la fecha y la hora, o deja ambas vacías',
  path: ['hora_inicio']
})
