import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { routes } from '@/app/routes'
import { AuthProvider } from '@/auth/AuthProvider'
import { fakeSession, fakeTenant, seedClinic, setInitialSession } from './fakeSupabase'

type Options = {
  signedIn?: boolean
  /** Clínica de la persona de la sesión. `null` = aún no tiene clínica. */
  tenant?: Record<string, unknown> | null
}

/** Monta la app completa en una ruta, con sesión y clínica simuladas por omisión. */
export async function renderApp(path = '/', { signedIn = true, tenant = fakeTenant() }: Options = {}) {
  setInitialSession(signedIn ? fakeSession() : null)
  // La clínica existe en la base aunque la persona aún no haya entrado.
  if (tenant) seedClinic(tenant)
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const utils = render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
  await waitFor(() => expect(screen.queryByText('Cargando…')).not.toBeInTheDocument())
  return { router, ...utils }
}
