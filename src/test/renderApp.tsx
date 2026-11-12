import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { ClinicProvider } from '@/app/ClinicProvider'
import { routes } from '@/app/routes'
import type { ClinicConfig } from '@/lib/clinic-config'

export function renderApp(path = '/', config?: ClinicConfig) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const utils = render(
    config ? (
      <ClinicProvider config={config}>
        <RouterProvider router={router} />
      </ClinicProvider>
    ) : (
      <ClinicProvider>
        <RouterProvider router={router} />
      </ClinicProvider>
    ),
  )
  return { router, ...utils }
}
