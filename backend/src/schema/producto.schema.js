import { z } from 'zod'
import { imagenId } from './common.js'

// Sin .default(): ver nota en cancha.schema.js
export const productoSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
  descripcion: z.string().trim().optional(),
  categoria: z.enum(['pala', 'ropa', 'accesorios', 'calzado'], {
    error: 'Categoría inválida'
  }),
  precio: z.number().min(0, 'El precio no puede ser negativo'),
  stock: z.number().int('El stock debe ser un número entero').min(0, 'El stock no puede ser negativo').optional(),
  activo: z.boolean().optional(),
  imagen_id: imagenId
})

export const productoUpdateSchema = productoSchema.partial()
