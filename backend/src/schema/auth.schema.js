import { z } from 'zod'

export const registerSchema = z.object({
  nombre: z.string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .trim(),
  apellido: z.string()
    .min(2, 'El apellido debe tener al menos 2 caracteres')
    .trim(),
  email: z.string()
    .email('Email inválido')
    .toLowerCase(),
  password: z.string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres'),
  telefono: z.string()
    .trim()
    .optional()
})

export const profileUpdateSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
  apellido: z.string().trim().min(2, 'El apellido debe tener al menos 2 caracteres').optional(),
  telefono: z.string().trim().optional()
}).strict()

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido').toLowerCase()
})

export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[a-f\d]{64}$/, 'Enlace inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres')
})

export const loginSchema = z.object({
  email: z.string()
    .email('Email inválido')
    .toLowerCase(),
  password: z.string()
    .min(1, 'La contraseña es requerida')
})