import { Outlet } from 'react-router'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { NewMenu } from '@/components/layout/NewMenu'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { Alert } from '@/components/ui/Alert'
import { useWorkspace } from '@/workspace/workspace-context'

/**
 * Layout principal.
 * - Escritorio (≥1024 px): menú lateral `night` + barra superior.
 * - Móvil y tablet: barra superior compacta + barra inferior + botón flotante "+ Nuevo".
 */
export function AppLayout() {
  const { active } = useWorkspace()
  const suspended = active?.tenant.status === 'suspended'
  return (
    <div className="flex min-h-dvh bg-surface text-ink">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-violet focus:px-4 focus:py-2 focus:text-on-violet"
      >
        Saltar al contenido
      </a>
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <div className="flex min-w-0 grow flex-col">
        <Topbar />
        <main id="contenido" tabIndex={-1} className="w-full max-w-310 grow px-4 pt-6 pb-32 outline-none md:px-6 lg:px-8 lg:pt-8 lg:pb-12">
          {suspended && (
            <Alert tone="warning" title="Tu clínica está en solo lectura" className="mb-6">
              Puedes consultar tu información, pero no hacer cambios. Escríbenos a soporte para reactivarla.
            </Alert>
          )}
          <Outlet />
        </main>
      </div>
      <MobileTabBar />
      <div className="fixed right-4 bottom-[calc(96px+env(safe-area-inset-bottom))] z-20 lg:hidden">
        <NewMenu variant="fab" />
      </div>
    </div>
  )
}
