import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

describe('App', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('sin variables de Supabase muestra qué falta configurar', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '')
    render(<App />)
    expect(screen.getByRole('alert')).toHaveTextContent('VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY')
  })
})
