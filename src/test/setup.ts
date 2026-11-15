import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { resetFakeSupabase } from './fakeSupabase'

// Ninguna prueba habla con Supabase: el cliente se reemplaza por uno simulado.
vi.mock('@/lib/supabase', async () => ({ supabase: (await import('./fakeSupabase')).fakeSupabase }))

afterEach(() => {
  cleanup()
  resetFakeSupabase()
  window.history.replaceState(null, '', '/')
  window.localStorage.clear()
})
