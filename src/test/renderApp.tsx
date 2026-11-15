import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { routes } from '@/app/routes'
import { AuthProvider } from '@/auth/AuthProvider'
import { fakeSession, fakeTenant, fakeUser, seedClinic, seedNotice, setInitialSession } from './fakeSupabase'

type Options = {
  signedIn?: boolean
  /** Clínica de la persona de la sesión. `null` = aún no tiene clínica. */
  tenant?: Record<string, unknown> | null
  /** ¿La persona ya aceptó el aviso vigente? (por omisión, sí). */
  consented?: boolean
  /** Rol de la persona en la clínica (por omisión, propietaria). */
  role?: string
  /** Metadatos de Auth de la persona (p. ej. `tour_seen_at`). */
  userMeta?: Record<string, unknown>
}

/** Monta la app completa en una ruta, con sesión y clínica simuladas por omisión. */
export async function renderApp(path = '/', { signedIn = true, tenant = fakeTenant(), consented = true, role = 'owner', userMeta = {} }: Options = {}) {
  setInitialSession(signedIn ? fakeSession(fakeUser({ user_metadata: userMeta })) : null)
  // La clínica existe en la base aunque la persona aún no haya entrado.
  if (tenant) seedClinic(tenant, undefined, role)
  seedNotice({ accepted: consented })
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const utils = render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
  await waitFor(() => expect(screen.queryByText('Cargando…')).not.toBeInTheDocument())
  return { router, ...utils }
}
