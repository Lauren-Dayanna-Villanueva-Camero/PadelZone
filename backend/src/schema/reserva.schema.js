import { z } from 'zod'

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato de hora inválido (HH:mm)')

// El precio no se acepta del cliente: se calcula en el servidor con la tarifa de la cancha
export const reservaSchema = z.object({
  cancha_id: z.string().min(1, 'La cancha es requerida'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  hora_inicio: hora,
  hora_fin: hora
}).refine(d => d.hora_fin > d.hora_inicio, {
  message: 'La hora de fin debe ser posterior a la hora de inicio',
  path: ['hora_fin']
}).refine(d => d.hora_inicio >= '07:00' && d.hora_fin <= '23:00', {
  // Mismo horario que ofrece el formulario de reservas
  message: 'El horario de las canchas es de 7:00 a 23:00',
  path: ['hora_inicio']
})
