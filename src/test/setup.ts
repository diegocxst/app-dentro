import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { resetFakeSupabase } from './fakeSupabase'

// Ninguna prueba habla con Supabase: el cliente se reemplaza por uno simulado.
vi.mock('@/lib/supabase', async () => ({ supabase: (await import('./fakeSupabase')).fakeSupabase }))

// jsdom no implementa URL.createObjectURL (vista previa de archivos).
let blobs = 0
URL.createObjectURL = () => `blob:prueba/${++blobs}`
URL.revokeObjectURL = () => undefined

afterEach(() => {
  cleanup()
  resetFakeSupabase()
  window.history.replaceState(null, '', '/')
  window.localStorage.clear()
})
