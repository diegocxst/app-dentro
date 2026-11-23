import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { GUIDE_TASKS } from '@/lib/onboarding'
import { fakeSupabase, fakeTenant, TENANT_ID } from '@/test/fakeSupabase'
import { renderApp } from '@/test/renderApp'

const allDone = { tasks: Object.fromEntries(GUIDE_TASKS.map((t) => [t.id, true])) }

describe('Inicio de primer uso (E2-A)', () => {
  it('las tareas de la guía son las mismas que acepta la base', () => {
    const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261116000100_onboarding_tasks.sql'), 'utf8')
    const ids = [...(/p_task in \(([^)]*)\)/.exec(sql)?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
    expect(ids).toEqual(GUIDE_TASKS.map((t) => t.id))
  })

  it('muestra la guía con la identidad ya hecha y los indicadores vacíos', async () => {
    await renderApp('/')
    expect(await screen.findByRole('heading', { level: 1, name: /Terminemos de armar tu clínica/ })).toBeInTheDocument()
    const guide = screen.getByRole('region', { name: 'Guía de inicio' })
    expect(within(guide).getByText(/1 de 7 listos/)).toBeInTheDocument()
    expect(within(guide).getByRole('progressbar', { name: 'Avance de la guía' })).toHaveAttribute('aria-valuenow', '14')
    expect(within(guide).getByRole('button', { name: 'Marcar como pendiente: Identidad de tu clínica' })).toHaveAttribute('aria-pressed', 'true')
    // La primera tarea pendiente lleva el botón principal.
    expect(within(guide).getByRole('link', { name: 'Agregar unidades dentales' })).toHaveAttribute('href', '/bienvenida/sucursales')
    expect(within(guide).getByRole('link', { name: 'Invitar' })).toHaveAttribute('href', '/bienvenida/equipo')
    expect(screen.getByText('Tu negocio, por dentro')).toBeInTheDocument()
    expect(screen.getAllByLabelText('Sin datos')).toHaveLength(3) // «Citas de hoy» va en «Mi día»
  })

  it('marca una tarea, guarda por RPC y actualiza el contador del menú', async () => {
    const user = userEvent.setup()
    await renderApp('/')
    const guide = await screen.findByRole('region', { name: 'Guía de inicio' })
    await user.click(within(guide).getByRole('button', { name: 'Marcar como listo: Invita a tu equipo' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('set_onboarding_task', { p_tenant: TENANT_ID, p_task: 'team', p_done: true })
    expect(await within(guide).findByText(/2 de 7 listos/)).toBeInTheDocument()
    const menu = screen.getByRole('navigation', { name: 'Menú principal' })
    expect(await within(menu).findByLabelText('2 de 7 listos')).toHaveTextContent('2/7')
  })

  it('un doctor ve la guía pero no la marca', async () => {
    await renderApp('/', { role: 'doctor' })
    const guide = await screen.findByRole('region', { name: 'Guía de inicio' })
    expect(within(guide).getByRole('button', { name: 'Marcar como listo: Invita a tu equipo' })).toBeDisabled()
  })

  it('con la guía completa, Inicio vuelve al tablero', async () => {
    await renderApp('/', { tenant: fakeTenant({ onboarding_state: allDone }) })
    expect(await screen.findByRole('heading', { level: 1, name: 'Inicio' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Guía de inicio' })).not.toBeInTheDocument()
  })

  it('/guia muestra la misma guía', async () => {
    await renderApp('/guia')
    expect(await screen.findByRole('region', { name: 'Guía de inicio' })).toBeInTheDocument()
  })
})

describe('recorrido de bienvenida', () => {
  it('aparece la primera vez, avanza 4 pasos y se recuerda', async () => {
    const user = userEvent.setup()
    await renderApp('/')
    const tour = await screen.findByRole('dialog', { name: 'Recorrido de bienvenida' })
    expect(within(tour).getByText('1 de 4')).toBeInTheDocument()
    expect(within(tour).getByText('Aquí creas todo')).toBeInTheDocument()
    for (let i = 0; i < 3; i++) await user.click(within(tour).getByRole('button', { name: 'Siguiente' }))
    expect(within(tour).getByText('Tu guía te acompaña')).toBeInTheDocument()
    await user.click(within(tour).getByRole('button', { name: 'Empezar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(fakeSupabase.auth.updateUser).toHaveBeenCalledWith({ data: { tour_seen_at: expect.any(String) } })
  })

  it('se puede saltar con el botón o con Escape, y repetir', async () => {
    const user = userEvent.setup()
    await renderApp('/')
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Saltar recorrido' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Repetir el recorrido' }))
    expect(screen.getByRole('dialog', { name: 'Recorrido de bienvenida' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('si ya lo vio, no vuelve a aparecer solo', async () => {
    await renderApp('/', { userMeta: { tour_seen_at: '2026-11-16T00:00:00Z' } })
    await screen.findByRole('region', { name: 'Guía de inicio' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
