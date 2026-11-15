import { BrandLogo } from '@/brand/BrandLogo'
import { Link } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { PRIVACY_NOTICE_VERSION } from '@/lib/privacy'

/**
 * ⚠️ BORRADOR sin valor legal. El aviso definitivo (LFPDPPP 2025, datos de salud
 * sensibles) lo redacta y revisa un abogado (pendiente P5). En desarrollo solo se usan
 * datos ficticios.
 */
export function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-surface px-4 py-10 text-ink">
      <article className="mx-auto flex max-w-2xl flex-col gap-6">
        <BrandLogo width={128} />
        <h1 className="m-0 text-title">Aviso de privacidad</h1>
        <Alert tone="warning" title="Documento en preparación">
          Este aviso es un borrador (versión {PRIVACY_NOTICE_VERSION}) mientras se revisa con un abogado. Por ahora dentro solo se usa con
          datos de prueba.
        </Alert>
        <section className="flex flex-col gap-2 text-body">
          <h2 className="m-0 text-subtitle">Qué datos pedimos al crear tu cuenta</h2>
          <ul className="m-0 flex list-disc flex-col gap-1 pl-5">
            <li>Tu nombre y tu correo.</li>
            <li>Si quieres, tu teléfono.</li>
            <li>Los datos de tu clínica: nombre, responsable y logo.</li>
            <li>Registros de seguridad: fechas de acceso y cambios importantes en tu cuenta.</li>
          </ul>
        </section>
        <Link to="/ingresar" className="font-semibold text-violet">
          Volver
        </Link>
      </article>
    </div>
  )
}
