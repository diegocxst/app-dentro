import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { canSeeConfig, canSeeSection, menuFor, mobileTabsFor } from '@/lib/access'
import { roleTag, withTitle } from '@/lib/identity'
import { BRANCH_ID, fakeDb, TENANT_ID } from '@/test/fakeSupabase'
import { renderApp } from '@/test/renderApp'

const ME = `m-${TENANT_ID}`
const menuLinks = async () => {
  const nav = await screen.findByRole('navigation', { name: 'Menú principal' })
  return within(nav)
    .getAllByRole('link')
    .map((l) => l.textContent?.replace(/\d+\/\d+$/, '').trim())
}

describe('Ajustes-D · reglas de acceso', () => {
  it('cada rol ve su menú', () => {
    expect(menuFor('owner').map((s) => s.label)).toContain('Crece tu clínica')
    expect(menuFor('doctor').map((s) => s.label)).toEqual(['Inicio', 'Agenda', 'Pacientes', 'Presupuestos', 'Cobros', 'Seguimientos', 'Tu equipo', 'Configuración'])
    expect(menuFor('doctor_collab').find((s) => s.label === 'Tu equipo')?.path).toBe('/equipo')
    expect(menuFor('reception').map((s) => s.id)).toEqual(['inicio', 'agenda', 'leads', 'pacientes', 'presupuestos', 'cobros', 'seguimientos', 'doctores', 'configuracion'])
    expect(mobileTabsFor('doctor')).toEqual(['inicio', 'agenda', 'pacientes', 'presupuestos'])
    expect(mobileTabsFor('reception')).toEqual(['inicio', 'agenda', 'pacientes', 'leads'])
    expect(canSeeSection(undefined, 'inicio')).toBe(false)
    expect(['identidad', 'sucursales', 'tratamientos', 'perfil'].filter((a) => canSeeConfig('doctor', a as never))).toEqual(['tratamientos', 'perfil'])
    expect(withTitle('Dra.', 'Ana Ruiz')).toBe('Dra. Ana Ruiz')
    expect(withTitle('Dra.', 'Dra. Maricarmen')).toBe('Dra. Maricarmen')
    expect(withTitle('', 'Ana Ruiz')).toBe('Ana Ruiz')
    expect(roleTag('owner', 'Propietario')).toBe('Propietario')
    expect(roleTag('owner', '')).toBe('Propietaria/o')
    expect(roleTag('doctor', 'Propietario')).toBe('Doctor/a')
    expect(canSeeConfig('admin', 'identidad')).toBe(true)
  })
})

describe('Ajustes-D · menú y rutas por rol', () => {
  it('un doctor no ve Leads, Crece, la guía ni la gestión; «+ Nuevo» no ofrece Lead', async () => {
    const user = userEvent.setup()
    await renderApp('/configuracion', { role: 'doctor' })
    const links = await menuLinks()
    expect(links).toContain('Tu equipo')
    expect(links).not.toContain('Leads')
    expect(links).not.toContain('Crece tu clínica')
    expect(links).not.toContain('Guía de inicio')
    const main = screen.getByRole('main')
    expect(within(main).getAllByRole('link').map((l) => l.textContent)).toEqual([
      expect.stringContaining('Tratamientos y precios'),
      expect.stringContaining('Mi perfil'),
    ])
    await user.click(screen.getAllByRole('button', { name: /Nuevo/ })[0]!)
    expect(screen.queryByRole('menuitem', { name: /Lead/ })).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Cita/ })).toBeInTheDocument()
  })

  it.each([
    ['/leads', '/'],
    ['/crece', '/'],
    ['/guia', '/'],
    ['/configuracion/identidad', '/configuracion'],
    ['/configuracion/sucursales', '/configuracion'],
    ['/doctores', '/equipo'],
    ['/doctores/m-otro', '/equipo'],
  ])('un doctor que abre %s vuelve a %s', async (path, to) => {
    const { router } = await renderApp(path, { role: 'doctor' })
    await waitFor(() => expect(router.state.location.pathname).toBe(to))
  })

  it('un doctor sí abre su propio perfil', async () => {
    const { router } = await renderApp(`/doctores/${ME}`, { role: 'doctor' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Dueña Prueba' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/doctores/${ME}`)
  })

  it('recepción ve Leads pero no Crece, la guía ni las comisiones', async () => {
    await renderApp('/', { role: 'reception' })
    const links = await menuLinks()
    expect(links).toContain('Leads')
    expect(links).toContain('Tu equipo')
    expect(links).not.toContain('Crece tu clínica')
    expect(links).not.toContain('Guía de inicio')
  })

  it('la gerencia ve todo, con la guía', async () => {
    await renderApp('/', { role: 'admin' })
    const links = await menuLinks()
    expect(links).toEqual(expect.arrayContaining(['Leads', 'Crece tu clínica', 'Tu equipo', 'Guía de inicio']))
  })
})

describe('Ajustes-D · tu cuenta en el menú', () => {
  it('un doctor ve debajo del logo su título, nombre, «Doctor/a» y su correo', async () => {
    fakeDb.profiles.push({ id: '00000000-0000-4000-8000-000000000001', full_name: 'Luis Castro Prueba', phone_e164: null, avatar_path: null, title: 'Dr.' })
    await renderApp('/', { role: 'doctor' })
    const nav = await screen.findByRole('navigation', { name: 'Menú principal' })
    expect(await within(nav).findByText('Dr. Luis Castro Prueba · Doctor/a')).toBeInTheDocument()
    expect(within(nav).getByText('duena@example.test')).toBeInTheDocument()
  })

  it('la dueña ve el título de propietaria de la clínica', async () => {
    await renderApp('/')
    const nav = await screen.findByRole('navigation', { name: 'Menú principal' })
    expect(await within(nav).findByText('Dueña Prueba · Propietaria')).toBeInTheDocument()
  })
})

describe('Ajustes-D · Tu equipo como directorio', () => {
  it('un doctor ve nombre, rol, especialidad y teléfono de sus compañeros', async () => {
    fakeDb.memberships.push(
      { id: 'm-d2', tenant_id: TENANT_ID, user_id: 'u-d2', role: 'doctor', status: 'active', display_name: '', created_at: '2026-11-16T00:00:00Z' },
      { id: 'm-r1', tenant_id: TENANT_ID, user_id: 'u-r1', role: 'reception', status: 'active', display_name: '', created_at: '2026-11-17T00:00:00Z' },
    )
    fakeDb.profiles.push(
      { id: 'u-d2', full_name: 'Dra. Karla Vega Prueba', phone_e164: '+525511112222', avatar_path: null },
      { id: 'u-r1', full_name: 'Recepción Prueba', phone_e164: '+525533334444', avatar_path: null },
    )
    // El teléfono del perfil en la clínica gana al de la cuenta.
    fakeDb.doctor_settings.push({ membership_id: 'm-d2', tenant_id: TENANT_ID, specialty: 'Endodoncia', calendar_color: null, phone_e164: '+525599998888' })
    await renderApp('/equipo', { role: 'doctor' })
    const team = await screen.findByRole('region', { name: 'Equipo' })
    const karla = (await within(team).findByText('Dra. Karla Vega Prueba')).closest('li')!
    expect(karla).toHaveTextContent('Endodoncia')
    expect(within(karla).getByRole('link', { name: /99 9988 88|9999 8888|99998888/ })).toHaveAttribute('href', 'tel:+525599998888')
    const recep = within(team).getByText('Recepción Prueba').closest('li')!
    expect(within(recep).getByRole('link')).toHaveAttribute('href', 'tel:+525533334444')
    expect(within(team).queryByRole('combobox')).not.toBeInTheDocument()
    const tabs = screen.getByRole('navigation', { name: 'Secciones de tu equipo' })
    expect(within(tabs).getAllByRole('link').map((l) => l.textContent)).toEqual(['Tu equipo', 'Comisiones'])
  })

  it('un doctor ve quién no tiene acceso, sin la opción de invitarlo', async () => {
    fakeDb.memberships.push({ id: 'm-off', tenant_id: TENANT_ID, user_id: null, role: 'doctor', status: 'active', display_name: 'Dra. Sin Correo Prueba', created_at: '2026-11-16T00:00:00Z' })
    await renderApp('/equipo', { role: 'doctor' })
    const team = await screen.findByRole('region', { name: 'Equipo' })
    const row = (await within(team).findByText('Dra. Sin Correo Prueba')).closest('li')!
    expect(row).toHaveTextContent('Sin acceso a la app')
    expect(within(row).queryByRole('link', { name: 'Invitarlo' })).not.toBeInTheDocument()
  })
})

describe('Ajustes-D · Inicio del doctor', () => {
  afterEach(() => vi.useRealTimers())

  it('resume sus citas de la semana, sus pacientes y sus tratamientos del mes', async () => {
    // Miércoles 9 ene 2030, 9:00 en CDMX.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2030-01-09T15:00:00Z'))
    fakeDb.chairs.push({ id: 'ch-1', tenant_id: TENANT_ID, branch_id: BRANCH_ID, name: 'Sillón 1', is_active: true })
    fakeDb.treatments.push(
      { id: 't-1', tenant_id: TENANT_ID, name: 'Limpieza Prueba', price: 800, is_active: true },
      { id: 't-2', tenant_id: TENANT_ID, name: 'Resina Prueba', price: 1200, is_active: true },
    )
    fakeDb.patients.push(
      { id: 'p-1', tenant_id: TENANT_ID, full_name: 'Laura Méndez Prueba', primary_doctor_id: ME, phone_e164: null, archived_at: null, tags: [], source: 'manual', created_at: '2026-11-16T10:00:00Z' },
      { id: 'p-2', tenant_id: TENANT_ID, full_name: 'Jorge Ramírez Prueba', primary_doctor_id: ME, phone_e164: null, archived_at: null, tags: [], source: 'manual', created_at: '2026-11-16T10:00:00Z' },
    )
    const cita = (id: string, start: string, treatment: string, status = 'programada', doctor = ME) =>
      fakeDb.appointments.push({
        id, tenant_id: TENANT_ID, branch_id: BRANCH_ID, chair_id: 'ch-1', doctor_id: doctor, patient_id: 'p-1', treatment_id: treatment,
        kind: 'tratamiento', status, starts_at: start, ends_at: start.replace('T16', 'T17').replace('T18', 'T19'), notes: null, cancel_reason: null,
      })
    cita('a1', '2030-01-07T16:00:00Z', 't-1')
    cita('a2', '2030-01-09T18:00:00Z', 't-1', 'confirmada')
    cita('a3', '2030-01-20T16:00:00Z', 't-2')
    cita('a4', '2030-01-08T16:00:00Z', 't-2', 'cancelada')
    cita('a5', '2030-01-09T16:00:00Z', 't-2', 'programada', 'm-otro')
    await renderApp('/', { role: 'doctor' })
    const summary = await screen.findByRole('region', { name: 'Mi resumen' })
    await waitFor(() => expect(within(summary).getByText('Citas esta semana').closest('div')).toHaveTextContent('2'))
    expect(within(summary).getByText('Mis pacientes').closest('div')).toHaveTextContent('2')
    const list = within(summary).getByRole('list', { name: 'Tratamientos del mes' })
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Limpieza Prueba2 citas', 'Resina Prueba1 cita'])
    expect(within(summary).getByRole('link', { name: 'Ver mis comisiones' })).toHaveAttribute('href', '/doctores/comisiones')
  })
})
