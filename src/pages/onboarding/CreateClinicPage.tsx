import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Navigate, useNavigate } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { uploadClinicLogo } from '@/data/branding'
import { createClinic } from '@/data/workspace'
import { useFilePreview } from '@/hooks/useFilePreview'
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
import { LogoPicker } from './LogoPicker'
import { OnboardingLayout } from './OnboardingLayout'

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
  // Tras crear la clínica se sigue al paso 2; sin esto, la guarda de abajo mandaría a Inicio.
  const [created, setCreated] = useState(false)
  const [logo, setLogo] = useFilePreview()
  const logoFile = logo?.file ?? null
  const logoPreview = logo?.url ?? null
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
  if (!created && state.status === 'ready' && state.memberships.length > 0) return <Navigate to="/" replace />

  const brand = ensureBrandContrast(isHexColor(color ?? '') ? color : null)
  const previewColor = isHexColor(color ?? '') ? brand.color : BRAND_SWATCHES[0].hex

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      const { whatsapp, ...rest } = values
      setCreated(true)
      const tenant = await createClinic({ ...rest, brandColor: values.brandColor.toUpperCase(), whatsappE164: normalizePhone(whatsapp) })
      setActiveTenant(tenant.id)
      if (logoFile) {
        // Si el logo falla, la clínica ya existe: entra con sus iniciales y lo sube después.
        await uploadClinicLogo(tenant.id, logoFile).catch(() => undefined)
      }
      await refresh()
      navigate('/bienvenida/sucursales', { replace: true })
    } catch (error) {
      setCreated(false)
      setFormError(clinicErrorMessage(error as { code?: string; message?: string }))
    }
  })

  const slugField = register('slug', { onChange: () => setSlugEdited(true) })

  return (
    <OnboardingLayout
      current={0}
      greeting={firstName ? `Hola, ${firstName}` : 'Te damos la bienvenida'}
      title="Así se verá tu clínica"
      description="Tu nombre, logo y color aparecen en el menú, en los presupuestos, en los mensajes a tus pacientes y en tu perfil público."
    >
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-7">
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

              <LogoPicker file={logoFile} previewUrl={logoPreview} onChange={setLogo} initials={clinicInitials(displayName || 'Tu clínica')} color={previewColor} />

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

            <IdentityPreview logoUrl={logoPreview} displayName={displayName ?? ''} ownerLine={ownerLine(ownerName ?? '', ownerTitle ?? '')} initials={clinicInitials(displayName || 'Tu clínica')} color={previewColor} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="grow text-caption text-ink-muted">Todo esto se cambia después en Configuración.</span>
            <Button type="submit" size="lg" loading={isSubmitting}>
              Continuar
            </Button>
          </div>
        </form>
    </OnboardingLayout>
  )
}
