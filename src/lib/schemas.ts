import { z } from 'zod'

// Esquemas de los formularios de acceso. Origen: core-base (Realt-In).

export const email = z.string().trim().min(1, 'Escribe tu correo.').email('Revisa que el correo esté bien escrito.').max(254)

// bcrypt (Supabase Auth) solo considera 72 bytes.
export const password = z
  .string()
  .min(8, 'Usa al menos 8 caracteres.')
  .max(72, 'Usa como máximo 72 caracteres.')
  .regex(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/, 'Incluye al menos una letra.')
  .regex(/\d/, 'Incluye al menos un número.')

const fullName = z.string().trim().min(2, 'Escribe tu nombre completo.').max(120, 'Máximo 120 caracteres.')
const confirmMatches = { path: ['confirmPassword'], message: 'Las contraseñas no coinciden.' }

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Escribe tu contraseña.'),
})
export type LoginValues = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    fullName,
    email,
    password,
    confirmPassword: z.string(),
    acceptPrivacy: z.boolean().refine((v) => v, 'Acepta el aviso de privacidad para crear tu cuenta.'),
  })
  .refine((v) => v.password === v.confirmPassword, confirmMatches)
export type RegisterValues = z.infer<typeof registerSchema>

/** Aceptar una invitación: el correo ya lo verificó el enlace. */
export const acceptInviteSchema = z
  .object({
    fullName,
    password,
    confirmPassword: z.string(),
    acceptPrivacy: z.boolean().refine((v) => v, 'Acepta el aviso de privacidad para activar tu cuenta.'),
  })
  .refine((v) => v.password === v.confirmPassword, confirmMatches)
export type AcceptInviteValues = z.infer<typeof acceptInviteSchema>

export const emailOnlySchema = z.object({ email })
export type EmailOnlyValues = z.infer<typeof emailOnlySchema>

export const newPasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, confirmMatches)
export type NewPasswordValues = z.infer<typeof newPasswordSchema>
