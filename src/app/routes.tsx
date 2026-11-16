import type { ReactNode } from 'react'
import { Outlet, type RouteObject } from 'react-router'
import { ConsentGate } from '@/auth/ConsentGate'
import { GuestOnly, RequireAuth } from '@/auth/guards'
import { RouteErrorElement } from '@/components/feedback/RouteErrorElement'
import { AppLayout } from '@/layouts/AppLayout'
import { AcceptInvitePage } from '@/pages/auth/AcceptInvitePage'
import { AuthCallbackPage } from '@/pages/auth/AuthCallbackPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { GuidePage } from '@/pages/GuidePage'
import { HomePage } from '@/pages/HomePage'
import { PrivacyPage } from '@/pages/legal/PrivacyPage'
import { ConfigurationPage } from '@/pages/configuration/ConfigurationPage'
import { TeamPage } from '@/pages/configuration/TeamPage'
import { BranchesConfigPage } from '@/pages/configuration/BranchesConfigPage'
import { TreatmentsConfigPage } from '@/pages/configuration/TreatmentsConfigPage'
import { CreateClinicPage } from '@/pages/onboarding/CreateClinicPage'
import { StepBranchesPage } from '@/pages/onboarding/StepBranchesPage'
import { StepTeamPage } from '@/pages/onboarding/StepTeamPage'
import { StepTreatmentsPage } from '@/pages/onboarding/StepTreatmentsPage'
import { StepWhatsappPage } from '@/pages/onboarding/StepWhatsappPage'
import { RequireClinic } from '@/workspace/RequireClinic'
import { WorkspaceProvider } from '@/workspace/WorkspaceProvider'
import { MorePage } from '@/pages/MorePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { SectionPage } from '@/pages/SectionPage'
import { PRIVACY_PATH } from '@/lib/privacy'
import { GUIDE_PATH, MORE_PATH, SECTIONS } from './navigation'

const guest = (page: ReactNode) => <GuestOnly>{page}</GuestOnly>

export const routes: RouteObject[] = [
  {
    // Si algo falla al mostrar cualquier pantalla: pantalla amable en lugar de la técnica.
    errorElement: <RouteErrorElement />,
    children: [
  // Acceso (públicas)
  { path: '/ingresar', element: guest(<LoginPage />) },
  { path: '/registro', element: guest(<RegisterPage />) },
  { path: '/recuperar', element: guest(<ForgotPasswordPage />) },
  { path: '/restablecer', element: <ResetPasswordPage /> },
  { path: '/auth/callback', element: <AuthCallbackPage /> },
  { path: '/auth/invitacion', element: <AcceptInvitePage /> },
  { path: PRIVACY_PATH, element: <PrivacyPage /> },

  // Área privada: sesión + aviso de privacidad aceptado + membresías.
  {
    element: (
      <RequireAuth>
        <ConsentGate>
          <WorkspaceProvider>
            <Outlet />
          </WorkspaceProvider>
        </ConsentGate>
      </RequireAuth>
    ),
    children: [
      // P04 paso 1: alta de la clínica (solo si aún no tiene una).
      { path: '/bienvenida', element: <CreateClinicPage /> },
      // P04 pasos 2 a 5 (con la clínica ya creada, sin el menú del panel).
      { path: '/bienvenida/sucursales', element: <RequireClinic><StepBranchesPage /></RequireClinic> },
      { path: '/bienvenida/equipo', element: <RequireClinic><StepTeamPage /></RequireClinic> },
      { path: '/bienvenida/tratamientos', element: <RequireClinic><StepTreatmentsPage /></RequireClinic> },
      { path: '/bienvenida/whatsapp', element: <RequireClinic><StepWhatsappPage /></RequireClinic> },
      // Panel de la clínica activa.
      {
        path: '/',
        element: (
          <RequireClinic>
            <AppLayout />
          </RequireClinic>
        ),
        children: [
          ...SECTIONS.filter((s) => s.id !== 'configuracion').map((s): RouteObject =>
            s.path === '/' ? { index: true, element: <HomePage /> } : { path: s.path.slice(1), element: <SectionPage id={s.id} /> },
          ),
          { path: 'configuracion', element: <ConfigurationPage /> },
          { path: 'configuracion/equipo', element: <TeamPage /> },
          { path: 'configuracion/sucursales', element: <BranchesConfigPage /> },
          { path: 'configuracion/tratamientos', element: <TreatmentsConfigPage /> },
          { path: GUIDE_PATH.slice(1), element: <GuidePage /> },
          { path: MORE_PATH.slice(1), element: <MorePage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
    ],
  },
]
