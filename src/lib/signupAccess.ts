// Registro abierto para dueños de clínica (D4). Con VITE_SIGNUP_MODE=closed el
// formulario no se muestra (p. ej. si se decide abrir solo por invitación). El
// cierre real lo aplica Supabase («Allow new users to sign up»). Origen: core-base.

type Env = { VITE_SIGNUP_MODE?: string | undefined }

/** 'closed' solo si el build lo pide; en desarrollo y por omisión, registro abierto. */
export function signupMode(env: Env = import.meta.env): 'open' | 'closed' {
  return env.VITE_SIGNUP_MODE === 'closed' ? 'closed' : 'open'
}

export function signupOpen(env: Env = import.meta.env): boolean {
  return signupMode(env) === 'open'
}
