import { describe, expect, it } from 'vitest'
import { authErrorMessage } from './errors'
import { emailOnlySchema, password } from './schemas'

describe('authErrorMessage', () => {
  it('traduce los errores conocidos sin revelar si la cuenta existe', () => {
    expect(authErrorMessage({ code: 'invalid_credentials' })).toBe('Correo o contraseña incorrectos.')
    expect(authErrorMessage({ status: 429 })).toMatch(/Demasiados intentos/)
    expect(authErrorMessage({ name: 'AuthRetryableFetchError' })).toMatch(/conexión/)
    expect(authErrorMessage({ code: 'user_not_found' })).toBe('Ocurrió un problema. Inténtalo de nuevo en unos minutos.')
    expect(authErrorMessage(null)).toMatch(/Ocurrió un problema/)
  })
})

describe('esquemas', () => {
  it('la contraseña pide 8+ caracteres, una letra y un número', () => {
    expect(password.safeParse('secreta123').success).toBe(true)
    expect(password.safeParse('12345678').success).toBe(false)
    expect(password.safeParse('sololetras').success).toBe(false)
    expect(password.safeParse('a1').success).toBe(false)
  })

  it('normaliza el correo', () => {
    expect(emailOnlySchema.parse({ email: '  ana@example.test ' }).email).toBe('ana@example.test')
    expect(emailOnlySchema.safeParse({ email: 'ana' }).success).toBe(false)
  })
})
