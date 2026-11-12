import { createBrowserRouter, RouterProvider } from 'react-router'
import { ClinicProvider } from './ClinicProvider'
import { routes } from './routes'

const router = createBrowserRouter(routes)

export function App() {
  return (
    <ClinicProvider>
      <RouterProvider router={router} />
    </ClinicProvider>
  )
}
