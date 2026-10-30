import { z } from 'zod'
import { imagenId } from './common.js'

// Sin .default(): en Zod 4 los defaults se aplican también dentro de .partial(),
// y una edición parcial sobrescribiría campos no enviados. Los valores por
// defecto ya los pone el modelo de Mongoose al crear.
export const canchaSchema = z.object({
  nombre: z.string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres'),
  tipo: z.enum(['Interior', 'Exterior'], {
    error: 'El tipo debe ser Interior o Exterior'
  }),
  techada: z.boolean().optional(),
  precio_por_hora: z.number()
    .min(0, 'El precio no puede ser negativo'),
  caracteristicas: z.array(z.string().trim().min(1)).optional(),
  activa: z.boolean().optional(),
  imagen_id: imagenId
})

export const canchaUpdateSchema = canchaSchema.partial()
