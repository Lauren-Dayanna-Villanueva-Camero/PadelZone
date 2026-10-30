import { z } from 'zod'

export const objectId = (message = 'Identificador inválido') =>
  z.string().regex(/^[a-f\d]{24}$/i, message)

// Imagen opcional: un id de Media, o null para quitarla
export const imagenId = objectId('Imagen inválida').nullable().optional()
