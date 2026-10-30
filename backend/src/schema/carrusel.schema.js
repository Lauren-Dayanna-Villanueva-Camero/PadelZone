import { z } from 'zod'
import { objectId } from './common.js'

// Sin .default(): ver nota en cancha.schema.js
export const carruselSchema = z.object({
  imagen_id: objectId('La imagen es requerida'),
  titulo: z.string().trim().min(2, 'El título debe tener al menos 2 caracteres'),
  subtitulo: z.string().trim().optional(),
  orden: z.number().int().min(0).optional(),
  activo: z.boolean().optional()
})

export const carruselUpdateSchema = carruselSchema.partial()
