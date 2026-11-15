import { BrandLogo } from '@/brand/BrandLogo'
import { Alert } from '@/components/ui/Alert'

/** Se muestra si faltan variables de entorno, en lugar de fallar con errores confusos. */
export function MissingConfigPage({ missing }: { missing: string[] }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface px-4">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <BrandLogo width={128} />
        <Alert tone="error" title="Falta configurar la app">
          Faltan estas variables: <code className="font-mono">{missing.join(', ')}</code>. Copia <code className="font-mono">.env.example</code>{' '}
          como <code className="font-mono">.env.local</code>, complétalo y reinicia el servidor.
        </Alert>
      </div>
    </div>
  )
}
