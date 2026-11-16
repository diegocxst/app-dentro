import { z } from 'zod'
import { normalizePhone } from './phone'
import { SLUG_PROBLEM_MESSAGES, slugProblem } from './slug'

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

// ── Alta de la clínica (P04 paso 1) ─────────────────────────────────────────

export const OWNER_TITLES = ['Propietaria', 'Propietario', 'Directora médica', 'Director médico', 'Socia', 'Socio'] as const

export const clinicSchema = z.object({
  kind: z.enum(['clinic', 'independent'], { message: 'Elige si es clínica o consultorio.' }),
  displayName: z.string().trim().min(2, 'Escribe al menos 2 caracteres.').max(120, 'Máximo 120 caracteres.'),
  ownerDisplayName: z.string().trim().min(2, 'Escribe el nombre de la doctora o el doctor responsable.').max(120, 'Máximo 120 caracteres.'),
  ownerTitle: z.enum(OWNER_TITLES, { message: 'Elige el cargo.' }),
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Escribe un color como #0E5E8A.'),
  whatsapp: z
    .string()
    .trim()
    .refine((v) => v === '' || normalizePhone(v) !== null, 'Escribe 10 dígitos (México) o el número con +lada internacional.'),
  city: z.string().trim().max(80, 'Máximo 80 caracteres.'),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .superRefine((value, ctx) => {
      const problem = slugProblem(value)
      if (problem) ctx.addIssue({ code: 'custom', message: SLUG_PROBLEM_MESSAGES[problem] })
    }),
})
export type ClinicValues = z.infer<typeof clinicSchema>

// ── Invitar a alguien al equipo (E1-B5c) ────────────────────────────────────
export const inviteSchema = z.object({
  email,
  role: z.enum(['admin', 'reception', 'doctor', 'doctor_collab'], { message: 'Elige un rol.' }),
  branchIds: z.array(z.string()),
})
export type InviteValues = z.infer<typeof inviteSchema>

// ── Identidad de la clínica (M10, Configuración) ────────────────────────────
export const identitySchema = clinicSchema.pick({ displayName: true, ownerDisplayName: true, ownerTitle: true, brandColor: true, whatsapp: true, city: true })
export type IdentityValues = z.infer<typeof identitySchema>

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Escribe tu nombre completo.').max(120, 'Máximo 120 caracteres.'),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || normalizePhone(v) !== null, 'Escribe 10 dígitos (México) o el número con +lada internacional.'),
})
export type ProfileValues = z.infer<typeof profileSchema>
