import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeDb, fakeSupabase, TENANT_ID } from '@/test/fakeSupabase'
import { renderApp } from '@/test/renderApp'
import { isChunkLoadError } from './chunk-error'
import { RouteErrorElement } from './RouteErrorElement'
import { SectionErrorBoundary } from './SectionErrorBoundary'

function Boom(): never {
  throw new Error('fallo interno con /ruta/secreta')
}

describe('estados de error', () => {
  afterEach(() => vi.restoreAllMocks())

  it('reconoce los errores de descarga de los navegadores', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/x.js'))).toBe(true)
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true)
    expect(isChunkLoadError(new Error('cualquier otra cosa'))).toBe(false)
  })

  it('una pantalla que falla muestra un aviso amable sin detalles técnicos', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const router = createMemoryRouter([{ path: '/', element: <Boom />, errorElement: <RouteErrorElement /> }])
    render(<RouterProvider router={router} />)
    const alert = screen.getByRole('alert')
    expect(within(alert).getByRole('heading', { name: 'Algo salió mal al mostrar esta pantalla' })).toBeInTheDocument()
    expect(alert).not.toHaveTextContent('/ruta/secreta')
    expect(within(alert).getByRole('button', { name: 'Volver a intentar' })).toBeInTheDocument()
    expect(within(alert).getByRole('link', { name: 'Ir a Inicio' })).toHaveAttribute('href', '/')
  })

  it('el error de una sección se limpia al cambiar de ruta', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const tree = (key: string, child: React.ReactNode) => (
      <MemoryRouter>
        <SectionErrorBoundary resetKey={key}>{child}</SectionErrorBoundary>
      </MemoryRouter>
    )
    const { rerender } = render(tree('/agenda', <Boom />))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    rerender(tree('/pacientes', <p>Pacientes</p>))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('Pacientes')).toBeInTheDocument()
  })

  it('avisa cuando no hay conexión y lo quita al volver', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get')
    online.mockReturnValue(true)
    await renderApp('/agenda')
    await screen.findByRole('heading', { level: 1, name: 'Agenda' })
    expect(screen.queryByText(/Sin conexión/)).not.toBeInTheDocument()
    online.mockReturnValue(false)
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByText(/Sin conexión\. Lo que hagas no se guardará/)).toBeInTheDocument()
    online.mockReturnValue(true)
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.queryByText(/Sin conexión/)).not.toBeInTheDocument()
  })

  it('si no carga el catálogo, deja volver a intentar', async () => {
    const user = userEvent.setup()
    fakeDb.treatments.push({ id: 't1', tenant_id: TENANT_ID, category: 'preventiva', name: 'Limpieza dental', price_mxn: 900, duration_minutes: 45, is_active: true })
    const real = fakeSupabase.from.getMockImplementation()!
    let failed = false
    fakeSupabase.from.mockImplementation((table: string) => {
      if (table === 'treatments' && !failed) {
        failed = true
        return { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: null, error: { message: 'red' } }) }) }) } as never
      }
      return real(table)
    })
    await renderApp('/configuracion/tratamientos')
    expect(await screen.findByText('No pudimos cargar tus tratamientos')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Volver a intentar' }))
    expect(await screen.findByLabelText('Precio de Limpieza dental')).toHaveValue('900')
    fakeSupabase.from.mockImplementation(real)
  })

  it('si no cargan las sucursales, deja volver a intentar', async () => {
    const user = userEvent.setup()
    const real = fakeSupabase.from.getMockImplementation()!
    let failed = false
    fakeSupabase.from.mockImplementation((table: string) => {
      if (table === 'chairs' && !failed) {
        failed = true
        return { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: null, error: { message: 'red' } }) }) }) } as never
      }
      return real(table)
    })
    await renderApp('/configuracion/sucursales')
    expect(await screen.findByText('No pudimos cargar tus sucursales')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Volver a intentar' }))
    expect(await screen.findByRole('region', { name: 'Sucursal Sucursal principal' })).toBeInTheDocument()
    fakeSupabase.from.mockImplementation(real)
  })
})
