import { z } from 'zod'
import { objectId } from './common.js'

export const iniciarPagoSchema = z.object({
  concepto: z.enum(['reserva', 'pedido', 'torneo', 'clase', 'multa'], { error: 'Concepto de pago inválido' }),
  id: objectId('Identificador inválido'),
  // Con Wompi el método de pago en línea se elige en la pasarela: basta con 'tarjeta'
  metodo: z.enum(['tarjeta', 'pse', 'nequi', 'efectivo'], { error: 'Elige un método de pago' })
})

// Datos del pago simulado. Nunca se guardan completos: solo marca y últimos 4 dígitos
export const simularPagoSchema = z.object({
  metodo: z.enum(['tarjeta', 'pse', 'nequi'], { error: 'Método de pago inválido' }),
  numero: z.string().max(25).optional(),
  titular: z.string().max(80).optional(),
  vence: z.string().max(7).optional(),
  cvv: z.string().max(4).optional(),
  banco: z.string().max(60).optional(),
  tipo_persona: z.enum(['natural', 'juridica']).optional(),
  documento: z.string().max(20).optional(),
  telefono: z.string().max(20).optional()
})

export const anularPagoSchema = z.object({
  motivo: z.string().trim().min(3, 'Explica brevemente por qué se anula').max(300, 'El motivo admite hasta 300 caracteres')
})
