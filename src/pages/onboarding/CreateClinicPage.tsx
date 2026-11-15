import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Navigate, useNavigate } from 'react-router'
import { BrandLogo } from '@/brand/BrandLogo'
import { SignOutButton } from '@/components/layout/SignOutButton'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { createClinic } from '@/data/workspace'
import { clinicInitials, ownerLine } from '@/lib/clinic-identity'
import { cn } from '@/lib/cn'
import { ensureBrandContrast, isHexColor } from '@/lib/color'
import { clinicErrorMessage } from '@/lib/errors'
import { normalizePhone } from '@/lib/phone'
import { clinicSchema, OWNER_TITLES, type ClinicValues } from '@/lib/schemas'
import { slugify } from '@/lib/slug'
import { useWorkspace } from '@/workspace/workspace-context'
import { BRAND_SWATCHES } from './brand-swatches'
import { IdentityPreview } from './IdentityPreview'
import { OnboardingSteps } from './OnboardingSteps'

const KINDS = [
  { value: 'clinic', title: 'Clínica', text: 'Varios doctores, recepción o más de una sucursal.' },
  { value: 'independent', title: 'Consultorio', text: 'Atiendes por tu cuenta o con un equipo pequeño.' },
] as const

/** P04 · Paso 1: identidad de la clínica (mockup Onboarding-Identidad). Crea la clínica. */
export function CreateClinicPage() {
  const { state, refresh, setActiveTenant } = useWorkspace()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const [slugEdited, setSlugEdited] = useState(false)
  const firstName = state.status === 'ready' ? (state.profile?.full_name.trim().split(/\s+/)[0] ?? '') : ''

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ClinicValues>({
    resolver: zodResolver(clinicSchema),
    defaultValues: { kind: 'clinic', displayName: '', ownerDisplayName: '', ownerTitle: 'Propietaria', brandColor: BRAND_SWATCHES[0].hex, whatsapp: '', city: '', slug: '' },
  })
  const [displayName, ownerName, ownerTitle, color, kind, slug] = useWatch({
    control,
    name: ['displayName', 'ownerDisplayName', 'ownerTitle', 'brandColor', 'kind', 'slug'],
  })

  // La dirección del perfil se sugiere a partir del nombre hasta que la persona la edite.
  useEffect(() => {
    if (!slugEdited) setValue('slug', slugify(displayName ?? ''), { shouldValidate: false })
  }, [displayName, slugEdited, setValue])

  if (state.status === 'loading') return <FullPageSpinner />
  if (state.status === 'ready' && state.memberships.length > 0) return <Navigate to="/" replace />

  const brand = ensureBrandContrast(isHexColor(color ?? '') ? color : null)
  const previewColor = isHexColor(color ?? '') ? brand.color : BRAND_SWATCHES[0].hex

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      const { whatsapp, ...rest } = values
      const tenant = await createClinic({ ...rest, brandColor: values.brandColor.toUpperCase(), whatsappE164: normalizePhone(whatsapp) })
      setActiveTenant(tenant.id)
      await refresh()
      navigate('/', { replace: true })
    } catch (error) {
      setFormError(clinicErrorMessage(error as { code?: string; message?: string }))
    }
  })

  const slugField = register('slug', { onChange: () => setSlugEdited(true) })

  return (
    <div className="flex min-h-dvh flex-wrap bg-surface text-ink">
      <aside className="flex flex-[1_1_320px] flex-col gap-8 bg-night px-6 py-8 text-on-night md:gap-10 md:px-8 md:py-10">
        <BrandLogo variant="negative" width={140} />
        <div className="flex flex-col gap-2">
          <h1 className="m-0 text-title text-on-night">{firstName ? `Hola, ${firstName}` : 'Te damos la bienvenida'}</h1>
          <p className="m-0 text-body text-on-night-muted">Vamos a dejar tu clínica lista en 5 pasos. Empecemos por su identidad.</p>
        </div>
        <div className="hidden md:block">
          <OnboardingSteps current={0} />
        </div>
        <div className="grow" />
        <SignOutButton tone="night" className="self-start" />
      </aside>

      <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-7 px-4 py-8 md:p-12">
        <div className="flex max-w-250 flex-col gap-2.5">
          <span className="text-label tracking-[0.06em] text-violet uppercase">Paso 1 de 5</span>
          <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-pill bg-lavender">
            <div className="h-1.5 w-1/5 rounded-pill bg-violet" />
          </div>
          <h2 className="mt-2 mb-0 text-title">Así se verá tu clínica</h2>
          <p className="m-0 text-body text-ink-muted">
            Tu nombre, logo y color aparecen en el menú, en los presupuestos, en los mensajes a tus pacientes y en tu perfil público.
          </p>
        </div>

        <form onSubmit={onSubmit} noValidate className="flex max-w-250 flex-col gap-7">
          {formError && <Alert tone="error">{formError}</Alert>}
          <div className="flex flex-wrap items-start gap-8">
            <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-5">
              <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                <legend className="mb-2 p-0 text-ui font-medium">¿Cómo trabajas?</legend>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {KINDS.map((k) => (
                    <label
                      key={k.value}
                      className={cn(
                        'flex cursor-pointer flex-col gap-1 rounded-md border bg-surface-raised p-3',
                        kind === k.value ? 'border-violet outline-2 outline-violet' : 'border-border',
                      )}
                    >
                      <span className="flex items-center gap-2 text-ui font-semibold">
                        <input type="radio" value={k.value} className="size-4 accent-violet" {...register('kind')} />
                        {k.title}
                      </span>
                      <span className="text-caption text-ink-muted">{k.text}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="flex items-center gap-4 rounded-md border border-dashed border-border-strong bg-surface-raised p-4">
                <div
                  role="img"
                  aria-label="Logo actual"
                  className="flex size-16 shrink-0 items-center justify-center rounded-lg font-display text-[22px] font-extrabold text-white"
                  style={{ backgroundColor: previewColor }}
                >
                  {clinicInitials(displayName || 'Tu clínica')}
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-ui font-semibold">Logo</span>
                  <span className="text-label font-normal text-ink-muted">Por ahora usamos tus iniciales. Podrás subir tu logo en Configuración.</span>
                </div>
              </div>

              <Input label="Nombre de la clínica o consultorio" autoComplete="organization" error={errors.displayName?.message} {...register('displayName')} />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="Doctora o doctor responsable" placeholder="Dra. Nombre Apellido" error={errors.ownerDisplayName?.message} {...register('ownerDisplayName')} />
                <Select label="Cargo" options={OWNER_TITLES.map((t) => ({ value: t, label: t }))} error={errors.ownerTitle?.message} {...register('ownerTitle')} />
              </div>

              <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                <legend className="mb-2 p-0 text-ui font-medium">Color de tu marca</legend>
                <div className="flex flex-wrap items-center gap-2.5">
                  {BRAND_SWATCHES.map((w) => {
                    const on = (color ?? '').toUpperCase() === w.hex
                    return (
                      <button
                        key={w.hex}
                        type="button"
                        aria-label={w.name}
                        aria-pressed={on}
                        onClick={() => setValue('brandColor', w.hex, { shouldValidate: true })}
                        className="size-11 cursor-pointer rounded-md border-0"
                        style={{ backgroundColor: w.hex, boxShadow: on ? '0 0 0 3px var(--surface-raised), 0 0 0 5px var(--night)' : 'none' }}
                      />
                    )
                  })}
                  <div className="w-36">
                    <Input label="Código" placeholder="#0E5E8A" maxLength={7} autoCapitalize="none" spellCheck={false} error={errors.brandColor?.message} {...register('brandColor')} />
                  </div>
                </div>
                <p className="m-0 text-label font-normal text-ink-muted" role="status">
                  {brand.adjusted && isHexColor(color ?? '')
                    ? `Oscurecimos un poco tu color (${brand.color}) para que el texto blanco se lea bien.`
                    : 'Revisamos que el texto se lea bien sobre tu color. Los botones y estados de la app no cambian.'}
                </p>
              </fieldset>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="WhatsApp de la clínica" type="tel" inputMode="tel" autoComplete="tel" placeholder="55 1234 5678" error={errors.whatsapp?.message} {...register('whatsapp')} />
                <Input label="Ciudad" autoComplete="address-level2" error={errors.city?.message} {...register('city')} />
              </div>

              <Input
                label="Dirección de tu perfil público"
                hint={`dentro.mx/${slug || 'tu-clinica'}`}
                autoCapitalize="none"
                spellCheck={false}
                error={errors.slug?.message}
                {...slugField}
              />
            </div>

            <IdentityPreview displayName={displayName ?? ''} ownerLine={ownerLine(ownerName ?? '', ownerTitle ?? '')} initials={clinicInitials(displayName || 'Tu clínica')} color={previewColor} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="grow text-caption text-ink-muted">Todo esto se cambia después en Configuración.</span>
            <Button type="submit" size="lg" loading={isSubmitting}>
              Continuar
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
