import { z } from 'zod'

export const pedidoSchema = z.object({
  items: z.array(z.object({
    producto_id: z.string().min(1, 'El producto es requerido'),
    cantidad: z.number().int('La cantidad debe ser un número entero').min(1, 'La cantidad mínima es 1')
  })).min(1, 'El pedido debe tener al menos un producto'),
  ciudad: z.string().trim().min(1, 'La ciudad es requerida'),
  direccion_envio: z.string().trim().min(1, 'La dirección es requerida'),
  telefono_envio: z.string().trim().min(1, 'El teléfono es requerido')
})