import type { ReactNode } from 'react'
import { Outlet, type RouteObject } from 'react-router'
import { GuestOnly, RequireAuth } from '@/auth/guards'
import { AppLayout } from '@/layouts/AppLayout'
import { AcceptInvitePage } from '@/pages/auth/AcceptInvitePage'
import { AuthCallbackPage } from '@/pages/auth/AuthCallbackPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { GuidePage } from '@/pages/GuidePage'
import { PrivacyPage } from '@/pages/legal/PrivacyPage'
import { CreateClinicPage } from '@/pages/onboarding/CreateClinicPage'
import { RequireClinic } from '@/workspace/RequireClinic'
import { WorkspaceProvider } from '@/workspace/WorkspaceProvider'
import { MorePage } from '@/pages/MorePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { SectionPage } from '@/pages/SectionPage'
import { PRIVACY_PATH } from '@/lib/privacy'
import { GUIDE_PATH, MORE_PATH, SECTIONS } from './navigation'

const guest = (page: ReactNode) => <GuestOnly>{page}</GuestOnly>

export const routes: RouteObject[] = [
  // Acceso (públicas)
  { path: '/ingresar', element: guest(<LoginPage />) },
  { path: '/registro', element: guest(<RegisterPage />) },
  { path: '/recuperar', element: guest(<ForgotPasswordPage />) },
  { path: '/restablecer', element: <ResetPasswordPage /> },
  { path: '/auth/callback', element: <AuthCallbackPage /> },
  { path: '/auth/invitacion', element: <AcceptInvitePage /> },
  { path: PRIVACY_PATH, element: <PrivacyPage /> },

  // Área privada: sesión + membresías.
  {
    element: (
      <RequireAuth>
        <WorkspaceProvider>
          <Outlet />
        </WorkspaceProvider>
      </RequireAuth>
    ),
    children: [
      // P04 paso 1: alta de la clínica (solo si aún no tiene una).
      { path: '/bienvenida', element: <CreateClinicPage /> },
      // Panel de la clínica activa.
      {
        path: '/',
        element: (
          <RequireClinic>
            <AppLayout />
          </RequireClinic>
        ),
        children: [
          ...SECTIONS.map((s): RouteObject =>
            s.path === '/' ? { index: true, element: <SectionPage id={s.id} /> } : { path: s.path.slice(1), element: <SectionPage id={s.id} /> },
          ),
          { path: GUIDE_PATH.slice(1), element: <GuidePage /> },
          { path: MORE_PATH.slice(1), element: <MorePage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]
