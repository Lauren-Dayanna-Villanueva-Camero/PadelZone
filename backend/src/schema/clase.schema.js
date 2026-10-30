import { z } from 'zod'

export const inscripcionClaseSchema = z.object({
  clase_id: z.number().int().min(1),
  clase_nombre: z.string().trim().min(1, 'La clase es requerida'),
  tipo_clase: z.string().trim().optional(),
  color: z.string().trim().optional(),
  grupo: z.string().trim().min(1, 'El grupo es requerido'),
  profesor: z.string().trim().optional(),
  dias: z.string().trim().optional(),
  horario: z.string().trim().min(1, 'El horario es requerido'),
  precio: z.string().trim().optional(),
  nivel: z.enum(['principiante', 'intermedio', 'avanzado'], { error: 'Nivel inválido' }),
  nombre_alumno: z.string().trim().min(2, 'El nombre es requerido'),
  telefono: z.string().trim().min(7, 'Teléfono inválido'),
  fecha_nacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de nacimiento inválida')
})
