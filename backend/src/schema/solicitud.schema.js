import { z } from 'zod'
import { objectId } from './common.js'
import { hora } from './torneo.schema.js'

const dia = (message) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, message)
const texto = (min, message) => z.string().trim().min(min, message)

// Solicitud de torneo de una empresa. Las reglas entre fechas (inscripciones
// antes del inicio, franja dentro del horario del club) se revisan con
// errorProgramacion en el controller, igual que en los torneos.
const solicitudBase = z.object({
  empresa: z.object({
    nombre: texto(2, 'El nombre de la empresa debe tener al menos 2 caracteres'),
    nit: z.string().trim().max(30, 'El NIT es demasiado largo').optional(),
    contacto: texto(2, 'Indica el nombre de la persona de contacto'),
    telefono: z.string().trim().regex(/^[\d\s+()-]{7,20}$/, 'El teléfono no es válido'),
    email: z.string().trim().toLowerCase().email('El email de contacto no es válido')
  }, { error: 'Faltan los datos de la empresa' }),
  nombre_torneo: texto(2, 'El nombre del torneo debe tener al menos 2 caracteres'),
  tipo_torneo: z.enum(['Amateur', 'Profesional', 'Comunidad'], { error: 'Tipo de torneo inválido' }),
  descripcion: z.string().trim().max(500, 'La descripción admite hasta 500 caracteres').optional(),
  modalidad: z.enum(['bloque', 'convenio'], { error: 'Elige alquiler por bloque o convenio' }),
  convenio_meses: z.union([z.literal(3), z.literal(6), z.literal(12)], {
    error: 'La duración del convenio debe ser 3, 6 o 12 meses'
  }).nullable().optional(),
  fecha_inicio: dia('La fecha de inicio es requerida'),
  fecha_fin: dia('La fecha de fin es requerida'),
  hora_inicio: hora,
  hora_fin: hora,
  duracion_partido_min: z.union([z.literal(60), z.literal(90), z.literal(120)], {
    error: 'La duración de cada partido debe ser 60, 90 o 120 minutos'
  }).optional(),
  canchas: z.array(objectId('Cancha inválida')).min(1, 'Elige al menos una cancha'),
  cupo_maximo_parejas: z.number().int('El cupo debe ser un número entero')
    .min(2, 'El torneo necesita al menos 2 parejas').max(64, 'El cupo máximo es de 64 parejas'),
  precio_inscripcion: z.number().min(0, 'El precio no puede ser negativo'),
  inscripcion_apertura: dia('La fecha de apertura de inscripciones es requerida'),
  inscripcion_cierre: dia('La fecha de cierre de inscripciones es requerida')
})

const fechasEnOrden = [(d) => d.fecha_fin >= d.fecha_inicio, {
  message: 'La fecha de fin no puede ser anterior a la de inicio',
  path: ['fecha_fin']
}]

export const solicitudSchema = solicitudBase.refine(...fechasEnOrden)

// Para cotizar solo hacen falta los datos que cambian el precio y la disponibilidad
export const cotizacionSchema = solicitudBase
  .omit({ empresa: true, nombre_torneo: true, tipo_torneo: true, descripcion: true })
  .refine(...fechasEnOrden)

export const respuestaSchema = z.object({
  respuesta: z.string().trim().max(500, 'La respuesta admite hasta 500 caracteres').optional()
})

export const rechazoSchema = z.object({
  respuesta: z.string().trim().min(3, 'Explica brevemente el motivo del rechazo')
    .max(500, 'La respuesta admite hasta 500 caracteres')
})
