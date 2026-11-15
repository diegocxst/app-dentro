import { env } from './env'

/** Destino del enlace de confirmación de registro (y de sus reenvíos). */
export const signupRedirectUrl = () => `${env.siteUrl}/auth/callback`
