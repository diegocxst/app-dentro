import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/auth/auth-context'
import { SignOutButton } from '@/components/layout/SignOutButton'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { acceptNotice, fetchCurrentNotice, hasAccepted, type PrivacyNotice } from '@/data/consents'
import { AuthLayout } from '@/layouts/AuthLayout'
import type { ConsentSource } from '@/lib/db'

type GateState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ok' }
  | { status: 'needed'; notice: PrivacyNotice; renewal: boolean }

/** Origen declarado en el registro o la invitación (metadatos de Auth). */
function declaredSource(meta: Record<string, unknown> | undefined): ConsentSource {
  return meta?.privacy_source === 'invite' ? 'invite' : 'signup'
}

/**
 * Exige el consentimiento de la versión VIGENTE del aviso de privacidad (LFPDPPP).
 * - Si la persona ya lo aceptó al registrarse o al activar su invitación (queda en sus
 *   metadatos de Auth), se registra la evidencia sin volver a preguntar.
 * - Si no (o si se publicó una versión nueva), se le pide aceptarlo antes de entrar.
 */
export function ConsentGate({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [state, setState] = useState<GateState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  const userId = user?.id
  const meta = user?.user_metadata as Record<string, unknown> | undefined
  const metaVersion = typeof meta?.privacy_notice_version === 'string' ? meta.privacy_notice_version : null
  const source = declaredSource(meta)

  useEffect(() => {
    if (!userId) return
    let current = true
    ;(async (): Promise<GateState> => {
      const notice = await fetchCurrentNotice()
      if (!notice) return { status: 'ok' } // Sin aviso publicado: no se bloquea el acceso.
      if (await hasAccepted(userId, notice.id)) return { status: 'ok' }
      if (metaVersion === notice.version) {
        await acceptNotice(notice.version, source)
        return { status: 'ok' }
      }
      return { status: 'needed', notice, renewal: metaVersion !== null }
    })().then(
      (next) => current && setState(next),
      () => current && setState({ status: 'error' }),
    )
    return () => {
      current = false
    }
  }, [userId, metaVersion, source, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  if (state.status === 'loading') return <FullPageSpinner />
  if (state.status === 'error') {
    return (
      <AuthLayout title="No pudimos revisar tu aviso de privacidad" footer={<SignOutButton className="mx-auto" />}>
        <div className="flex flex-col gap-4">
          <Alert tone="error">Revisa tu conexión y vuelve a intentarlo.</Alert>
          <Button block size="lg" onClick={retry}>
            Volver a intentar
          </Button>
        </div>
      </AuthLayout>
    )
  }
  if (state.status === 'needed') return <ConsentScreen notice={state.notice} renewal={state.renewal} onDone={retry} />
  return <>{children}</>
}

function ConsentScreen({ notice, renewal, onDone }: { notice: PrivacyNotice; renewal: boolean; onDone: () => void }) {
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accept = async () => {
    if (!checked) {
      setError('Marca la casilla para continuar.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await acceptNotice(notice.version, 'renewal')
      onDone()
    } catch (e) {
      const code = (e as { code?: string }).code
      // 22023: se publicó otra versión mientras la pantalla estaba abierta.
      if (code === '22023') onDone()
      else setError('No pudimos guardar tu aceptación. Revisa tu conexión y vuelve a intentarlo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title={renewal ? 'Actualizamos el aviso de privacidad' : 'Acepta el aviso de privacidad'}
      subtitle="Para usar dentro necesitamos tu consentimiento. Te explicamos qué datos usamos y para qué."
      footer={<SignOutButton className="mx-auto" />}
    >
      <div className="flex flex-col gap-5" data-consent-version={notice.version}>
        {error && <Alert tone="error">{error}</Alert>}
        <p className="m-0 text-ui text-ink-muted">
          Versión vigente: <strong className="font-semibold text-ink">{notice.title}</strong>.{' '}
          <Link to={notice.url_path} target="_blank" className="font-semibold text-violet underline-offset-2 hover:underline">
            Léelo aquí
          </Link>
          .
        </p>
        <Checkbox label="Leí y acepto el aviso de privacidad." checked={checked} onChange={(e) => setChecked(e.target.checked)} />
        <Button block size="lg" loading={busy} onClick={() => void accept()}>
          Aceptar y continuar
        </Button>
      </div>
    </AuthLayout>
  )
}
