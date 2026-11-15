import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { ClinicProvider } from '@/app/ClinicProvider'
import { routes } from '@/app/routes'
import { AuthProvider } from '@/auth/AuthProvider'
import type { ClinicConfig } from '@/lib/clinic-config'
import { fakeSession, setInitialSession } from './fakeSupabase'

type Options = { config?: ClinicConfig; signedIn?: boolean }

/** Monta la app completa en una ruta, con sesión simulada por omisión. */
export async function renderApp(path = '/', { config, signedIn = true }: Options = {}) {
  setInitialSession(signedIn ? fakeSession() : null)
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const tree = (
    <AuthProvider>
      {config ? (
        <ClinicProvider config={config}>
          <RouterProvider router={router} />
        </ClinicProvider>
      ) : (
        <ClinicProvider>
          <RouterProvider router={router} />
        </ClinicProvider>
      )}
    </AuthProvider>
  )
  const utils = render(tree)
  await waitFor(() => expect(screen.queryByText('Cargando…')).not.toBeInTheDocument())
  return { router, ...utils }
}
