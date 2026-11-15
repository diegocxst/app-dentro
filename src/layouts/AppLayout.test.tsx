import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SECTIONS } from '@/app/navigation'
import { fakeTenant } from '@/test/fakeSupabase'
import { renderApp } from '@/test/renderApp'

describe('AppLayout', () => {
  it('muestra el menú lateral con la identidad de la clínica, las 10 secciones, la guía y "Hecho con dentro"', async () => {
    await renderApp('/')
    const menu = screen.getByRole('navigation', { name: 'Menú principal' })
    expect(await within(menu).findByRole('img', { name: 'Logo de Clínica Prueba' })).toBeInTheDocument()
    expect(within(menu).getByText('Clínica Prueba')).toBeInTheDocument()
    expect(within(menu).getByText('Dra. Prueba · Propietaria')).toBeInTheDocument()

    const links = within(within(menu).getAllByRole('list')[0]!).getAllByRole('link')
    expect(links.map((l) => l.textContent)).toEqual(SECTIONS.map((s) => s.label))
    expect(links[0]).toHaveAttribute('aria-current', 'page')

    expect(within(menu).getByRole('link', { name: /Guía de inicio/ })).toHaveAttribute('href', '/guia')
    expect(within(menu).getByText('Hecho con')).toBeInTheDocument()
    expect(within(menu).getByRole('img', { name: 'dentro' })).toHaveAttribute('src', '/brand/dentro-horizontal-negativo.svg')
  })

  it('usa el brand_color validado para las iniciales', async () => {
    await renderApp('/', { tenant: fakeTenant({ display_name: 'Clínica Dental Sonríe', brand_color: '#FFEEDF' }) })
    const menu = screen.getByRole('navigation', { name: 'Menú principal' })
    const logo = within(menu).getByRole('img', { name: 'Logo de Clínica Dental Sonríe' })
    expect(logo).toHaveTextContent('CS')
    expect(logo.style.backgroundColor).not.toBe('rgb(255, 238, 223)')
  })

  it('muestra la barra superior: búsqueda, sucursal, notificaciones y "+ Nuevo"', async () => {
    await renderApp('/')
    expect(screen.getAllByRole('searchbox', { name: 'Buscar' }).length).toBeGreaterThan(0)
    expect(await screen.findByRole('combobox', { name: 'Sucursal' })).toHaveDisplayValue('Sucursal principal')
    expect(screen.getAllByRole('button', { name: 'Notificaciones' }).length).toBeGreaterThan(0)

    // Uno en la barra superior (escritorio) y el botón flotante (móvil); el CSS muestra solo uno.
    const nuevos = screen.getAllByRole('button', { name: 'Nuevo', expanded: false })
    expect(nuevos).toHaveLength(2)
    for (const b of nuevos) expect(b).toHaveAttribute('aria-haspopup', 'menu')
  })

  it('abre y cierra el menú de "+ Nuevo"', async () => {
    const user = userEvent.setup()
    await renderApp('/')
    const [topbarNuevo] = screen.getAllByRole('button', { name: 'Nuevo' })
    await user.click(topbarNuevo!)
    const menu = screen.getByRole('menu', { name: 'Crear nuevo' })
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Cita', 'Paciente', 'Lead', 'Presupuesto'])
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('muestra la barra inferior móvil Inicio · Agenda · Pacientes · Leads · Más', async () => {
    await renderApp('/')
    const tabs = screen.getByRole('navigation', { name: 'Navegación' })
    expect(within(tabs).getAllByRole('link').map((l) => l.textContent)).toEqual(['Inicio', 'Agenda', 'Pacientes', 'Leads', 'Más'])
  })
})

describe('navegación', () => {
  it('cada sección tiene su página vacía con estado explicativo', async () => {
    // Inicio muestra la guía de primer uso (ver pages/home.test.tsx).
    for (const s of SECTIONS.filter((x) => x.id !== 'inicio')) {
      const { unmount } = await renderApp(s.path)
      expect(screen.getByRole('heading', { level: 1, name: s.label })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 2, name: s.empty.title })).toBeInTheDocument()
      unmount()
    }
  })

  it('navega entre rutas desde el menú lateral y la barra inferior', async () => {
    const user = userEvent.setup()
    const { router } = await renderApp('/')
    const menu = screen.getByRole('navigation', { name: 'Menú principal' })

    await user.click(within(menu).getByRole('link', { name: 'Presupuestos' }))
    expect(router.state.location.pathname).toBe('/presupuestos')
    expect(screen.getByRole('heading', { level: 1, name: 'Presupuestos' })).toBeInTheDocument()
    expect(within(menu).getByRole('link', { name: 'Presupuestos' })).toHaveAttribute('aria-current', 'page')

    await user.click(within(menu).getByRole('link', { name: /Guía de inicio/ }))
    expect(screen.getByRole('heading', { level: 1, name: 'Guía de inicio' })).toBeInTheDocument()

    const tabs = screen.getByRole('navigation', { name: 'Navegación' })
    await user.click(within(tabs).getByRole('link', { name: 'Más' }))
    expect(router.state.location.pathname).toBe('/mas')
    await user.click(within(screen.getByRole('navigation', { name: 'Más secciones' })).getByRole('link', { name: 'Cobros' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Cobros' })).toBeInTheDocument()

    await user.click(within(tabs).getByRole('link', { name: 'Inicio' }))
    expect(router.state.location.pathname).toBe('/')
  })

  it('muestra una página 404 dentro del layout', async () => {
    await renderApp('/no-existe')
    expect(screen.getByRole('heading', { level: 1, name: 'No encontramos esta página' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Menú principal' })).toBeInTheDocument()
  })
})
