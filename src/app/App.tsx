import { createBrowserRouter, RouterProvider } from 'react-router'
import { AuthProvider } from '@/auth/AuthProvider'
import { missingEnv } from '@/lib/env'
import { MissingConfigPage } from '@/pages/MissingConfigPage'
import { ClinicProvider } from './ClinicProvider'
import { routes } from './routes'

const router = createBrowserRouter(routes)

export function App() {
  const missing = missingEnv()
  if (missing.length > 0) return <MissingConfigPage missing={missing} />
  return (
    <AuthProvider>
      <ClinicProvider>
        <RouterProvider router={router} />
      </ClinicProvider>
    </AuthProvider>
  )
}
