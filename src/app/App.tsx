import { createBrowserRouter, RouterProvider } from 'react-router'
import { AuthProvider } from '@/auth/AuthProvider'
import { missingEnv } from '@/lib/env'
import { MissingConfigPage } from '@/pages/MissingConfigPage'
import { routes } from './routes'

const router = createBrowserRouter(routes)

export function App() {
  const missing = missingEnv()
  if (missing.length > 0) return <MissingConfigPage missing={missing} />
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
