import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { clearClinicLogo, removeLogoFile, uploadClinicLogo } from '@/data/branding'
import { useFilePreview } from '@/hooks/useFilePreview'
import { clinicInitials, ownerLine } from '@/lib/clinic-identity'
import { ensureBrandContrast, isHexColor } from '@/lib/color'
import { rpcErrorMessage } from '@/lib/errors'
import { formatPhone, normalizePhone } from '@/lib/phone'
import { isManager } from '@/lib/roles'
import { identitySchema, OWNER_TITLES, type IdentityValues } from '@/lib/schemas'
import { supabase } from '@/lib/supabase'
import { BRAND_SWATCHES } from '@/pages/onboarding/brand-swatches'
import { IdentityPreview } from '@/pages/onboarding/IdentityPreview'
import { LogoPicker } from '@/pages/onboarding/LogoPicker'
import { PageHeader } from '@/pages/PageHeader'
import { useWorkspace } from '@/workspace/workspace-context'

/** M10 · P31: identidad de la clínica (nombre, responsable, color, logo y contacto). */
export function IdentityPage() {
  const { active, logoUrl, refresh } = useWorkspace()
  const tenant = active?.tenant
  const canEdit = isManager(active?.role) && tenant?.status === 'active'
  const [logo, setLogo] = useFilePreview()
  const [removeLogo, setRemoveLogo] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const titleOptions = OWNER_TITLES.map((t) => ({ value: t, label: t }))
  const currentTitle = (OWNER_TITLES as readonly string[]).includes(tenant?.owner_title ?? '') ? (tenant!.owner_title as IdentityValues['ownerTitle']) : 'Propietaria'

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<IdentityValues>({
    resolver: zodResolver(identitySchema),
    defaultValues: {
      displayName: tenant?.display_name ?? '',
      ownerDisplayName: tenant?.owner_display_name ?? '',
      ownerTitle: currentTitle,
      brandColor: tenant?.brand_color ?? BRAND_SWATCHES[0].hex,
      whatsapp: tenant?.whatsapp_e164 ? formatPhone(tenant.whatsapp_e164) : '',
      city: tenant?.city ?? '',
    },
  })
  const [displayName, ownerName, ownerTitle, color] = useWatch({ control, name: ['displayName', 'ownerDisplayName', 'ownerTitle', 'brandColor'] })

  if (!tenant || !active) return null

  const brand = ensureBrandContrast(isHexColor(color ?? '') ? color : null)
  const previewColor = isHexColor(color ?? '') ? brand.color : tenant.brand_color
  const shownLogo = removeLogo ? null : (logo?.url ?? logoUrl)
  const logoChanged = Boolean(logo) || removeLogo

  const onSubmit = handleSubmit(async (v) => {
    setNotice(null)
    try {
      const { error } = await supabase.rpc('update_tenant_identity', {
        p_tenant: tenant.id,
        p_display_name: v.displayName,
        p_owner_display_name: v.ownerDisplayName,
        p_owner_title: v.ownerTitle,
        p_brand_color: v.brandColor.toUpperCase(),
        p_whatsapp_e164: normalizePhone(v.whatsapp) ?? '',
        p_city: v.city,
      })
      if (error) throw error
      const oldPath = tenant.logo_path
      if (logo) {
        await uploadClinicLogo(tenant.id, logo.file)
        if (oldPath) await removeLogoFile(oldPath)
      } else if (removeLogo && oldPath) {
        await clearClinicLogo(tenant.id, oldPath)
      }
      setLogo(null)
      setRemoveLogo(false)
      await refresh()
      reset(v)
      setNotice({ tone: 'success', text: 'Listo. Guardamos la identidad de tu clínica.' })
    } catch (e) {
      setNotice({ tone: 'error', text: rpcErrorMessage(e as { code?: string }, { invalid: 'Revisa el nombre, el color y el WhatsApp.' }) })
    }
  })

  return (
    <>
      <PageHeader eyebrow="Configuración" title="Identidad de tu clínica" actions={<Link to="/configuracion" className="text-ui font-semibold text-violet">Volver</Link>} />
      {!canEdit && <Alert tone="info" className="mb-6">Solo la dueña, el dueño o la administración pueden cambiar la identidad.</Alert>}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
        <div className="flex flex-wrap items-start gap-8">
          <fieldset disabled={!canEdit} className="m-0 flex min-w-0 flex-[1_1_380px] flex-col gap-5 border-0 p-0">
            <LogoPicker
              file={logo?.file ?? null}
              previewUrl={logo?.url ?? null}
              currentUrl={removeLogo ? null : logoUrl}
              onRemoveCurrent={() => setRemoveLogo(true)}
              onChange={(f) => {
                setRemoveLogo(false)
                setLogo(f)
              }}
              initials={clinicInitials(displayName || tenant.display_name)}
              color={previewColor}
            />
            <Input label="Nombre de la clínica o consultorio" error={errors.displayName?.message} {...register('displayName')} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Doctora o doctor responsable" error={errors.ownerDisplayName?.message} {...register('ownerDisplayName')} />
              <Select label="Cargo" options={titleOptions} error={errors.ownerTitle?.message} {...register('ownerTitle')} />
            </div>
            <Card padding="sm" className="flex flex-col gap-2">
              <span className="text-ui font-medium">Color de tu marca</span>
              <div className="flex flex-wrap items-center gap-2.5">
                {BRAND_SWATCHES.map((w) => {
                  const on = (color ?? '').toUpperCase() === w.hex
                  return (
                    <button
                      key={w.hex}
                      type="button"
                      aria-label={w.name}
                      aria-pressed={on}
                      onClick={() => setValue('brandColor', w.hex, { shouldValidate: true, shouldDirty: true })}
                      className="size-11 cursor-pointer rounded-md border-0"
                      style={{ backgroundColor: w.hex, boxShadow: on ? '0 0 0 3px var(--surface-raised), 0 0 0 5px var(--night)' : 'none' }}
                    />
                  )
                })}
                <div className="w-36">
                  <Input label="Código" maxLength={7} autoCapitalize="none" spellCheck={false} error={errors.brandColor?.message} {...register('brandColor')} />
                </div>
              </div>
              <p className="m-0 text-label font-normal text-ink-muted" role="status">
                {brand.adjusted && isHexColor(color ?? '')
                  ? `Oscurecimos un poco tu color (${brand.color}) para que el texto blanco se lea bien.`
                  : 'Los botones y estados de la app no cambian: tu color va en el menú, los presupuestos y los mensajes.'}
              </p>
            </Card>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="WhatsApp de la clínica" type="tel" inputMode="tel" placeholder="55 1234 5678" error={errors.whatsapp?.message} {...register('whatsapp')} />
              <Input label="Ciudad" error={errors.city?.message} {...register('city')} />
            </div>
            <p className="m-0 text-caption text-ink-muted">Dirección de tu perfil público: dentro.mx/{tenant.slug}</p>
          </fieldset>
          <IdentityPreview
            logoUrl={shownLogo}
            displayName={displayName ?? ''}
            ownerLine={ownerLine(ownerName ?? '', ownerTitle ?? '')}
            initials={clinicInitials(displayName || tenant.display_name)}
            color={previewColor}
          />
        </div>
        {canEdit && (
          <div className="flex justify-end">
            <Button type="submit" size="lg" loading={isSubmitting} disabled={!isDirty && !logoChanged}>
              Guardar cambios
            </Button>
          </div>
        )}
      </form>
    </>
  )
}
