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
import { IdentityPage } from '@/pages/configuration/IdentityPage'
import { ProfilePage } from '@/pages/configuration/ProfilePage'
import { EditPatientPage } from '@/pages/patients/EditPatientPage'
import { NewPatientPage } from '@/pages/patients/NewPatientPage'
import { PatientPage } from '@/pages/patients/PatientPage'
import { PatientsPage } from '@/pages/patients/PatientsPage'
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
import { AgendaPage } from '@/pages/agenda/AgendaPage'
import { CobrosPage } from '@/pages/payments/CobrosPage'
import { RegisterPaymentPage } from '@/pages/payments/RegisterPaymentPage'
import { QuotePage } from '@/pages/quotes/QuotePage'
import { QuotesPage } from '@/pages/quotes/QuotesPage'
import { SendQuotePage } from '@/pages/quotes/SendQuotePage'
import { ConvertLeadPage } from '@/pages/leads/ConvertLeadPage'
import { LeadPage } from '@/pages/leads/LeadPage'
import { LeadsPage } from '@/pages/leads/LeadsPage'
import { NewLeadPage } from '@/pages/leads/NewLeadPage'
import { AppointmentFormPage } from '@/pages/agenda/AppointmentFormPage'
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
          ...SECTIONS.filter((s) => s.id !== 'configuracion' && s.id !== 'pacientes' && s.id !== 'agenda' && s.id !== 'leads' && s.id !== 'presupuestos' && s.id !== 'cobros').map((s): RouteObject =>
            s.path === '/' ? { index: true, element: <HomePage /> } : { path: s.path.slice(1), element: <SectionPage id={s.id} /> },
          ),
          { path: 'agenda', element: <AgendaPage /> },
          { path: 'agenda/nueva', element: <AppointmentFormPage /> },
          { path: 'agenda/:id/editar', element: <AppointmentFormPage /> },
          { path: 'leads', element: <LeadsPage /> },
          { path: 'leads/nuevo', element: <NewLeadPage /> },
          { path: 'leads/:id', element: <LeadPage /> },
          { path: 'leads/:id/convertir', element: <ConvertLeadPage /> },
          { path: 'presupuestos', element: <QuotesPage /> },
          { path: 'presupuestos/nuevo', element: <QuotePage /> },
          { path: 'presupuestos/:id', element: <QuotePage /> },
          { path: 'presupuestos/:id/enviar', element: <SendQuotePage /> },
          { path: 'cobros', element: <CobrosPage /> },
          { path: 'cobros/nuevo', element: <RegisterPaymentPage /> },
          { path: 'pacientes', element: <PatientsPage /> },
          { path: 'pacientes/nuevo', element: <NewPatientPage /> },
          { path: 'pacientes/:id', element: <PatientPage /> },
          { path: 'pacientes/:id/editar', element: <EditPatientPage /> },
          { path: 'configuracion', element: <ConfigurationPage /> },
          { path: 'configuracion/equipo', element: <TeamPage /> },
          { path: 'configuracion/sucursales', element: <BranchesConfigPage /> },
          { path: 'configuracion/tratamientos', element: <TreatmentsConfigPage /> },
          { path: 'configuracion/identidad', element: <IdentityPage /> },
          { path: 'configuracion/perfil', element: <ProfilePage /> },
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
