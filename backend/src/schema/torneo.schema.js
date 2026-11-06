import { z } from 'zod'
import { objectId } from './common.js'

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
  }).optional()
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
