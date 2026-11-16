import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { documentExt, documentPath, documentProblem, formatSize } from '@/lib/documents'
import { fakeDb, fakeStorage, fakeSupabase, TENANT_ID } from '@/test/fakeSupabase'
import { renderApp } from '@/test/renderApp'

function seedPatient() {
  fakeDb.patients.push({
    id: 'p-1', tenant_id: TENANT_ID, full_name: 'Paciente Docs Prueba', birth_date: null, phone_e164: null, email: null,
    source: 'manual', primary_doctor_id: null, tags: [], archived_at: null, created_at: '2026-11-16T10:00:00Z',
    consent: { method: 'papel', notice_version: 'clinica-borrador-2026-11', recorded_at: '2026-11-16T10:00:00Z' },
  })
}
function seedDoc(over: Record<string, unknown> = {}) {
  fakeDb.patient_documents.push({
    id: 'd-1', tenant_id: TENANT_ID, patient_id: 'p-1', kind: 'radiografia', name: 'Panorámica',
    storage_path: `${TENANT_ID}/p-1/11111111-1111-4111-8111-111111111111.jpg`, mime: 'image/jpeg', size_bytes: 2048,
    created_at: '2026-11-16T12:00:00Z', archived_at: null, ...over,
  })
}
async function openDocsTab(role = 'owner', applyAccept = true) {
  const user = userEvent.setup({ applyAccept })
  await renderApp('/pacientes/p-1', { role })
  await user.click(await screen.findByRole('tab', { name: /Documentos/ }))
  return user
}

describe('reglas de documentos', () => {
  it('acepta PDF, imágenes y STL de hasta 25 MB', () => {
    expect(documentExt({ type: 'application/pdf', name: 'a.pdf' })).toBe('pdf')
    expect(documentExt({ type: '', name: 'escaneo.STL' })).toBe('stl')
    expect(documentProblem({ type: 'application/x-msdownload', name: 'x.exe', size: 10 })).toBe('Usa PDF, JPG, PNG, WebP o STL.')
    expect(documentProblem({ type: 'image/jpeg', name: 'x.jpg', size: 26 * 1024 * 1024 })).toBe('El archivo pesa más de 25 MB.')
    expect(documentPath('t', 'p', 'pdf', 'ABC')).toBe('t/p/abc.pdf')
    expect(formatSize(2048)).toBe('2 KB')
  })
})

describe('M7 · documentos del paciente', () => {
  afterEach(() => vi.restoreAllMocks())

  it('sube un archivo a Storage privado y lo registra', async () => {
    seedPatient()
    const user = await openDocsTab()
    const file = new File([new Uint8Array([37, 80, 68, 70])], 'Historia clinica.pdf', { type: 'application/pdf' })
    await user.upload(screen.getByLabelText('Elegir archivo'), file)
    expect(screen.getByLabelText('Nombre del documento')).toHaveValue('Historia clinica')
    await user.selectOptions(screen.getByLabelText('Tipo'), 'formulario')
    await user.click(screen.getByRole('button', { name: 'Guardar documento' }))

    expect(fakeStorage).toHaveLength(1)
    expect(fakeStorage[0]).toMatchObject({ bucket: 'patient-documents', type: 'application/pdf' })
    expect(fakeStorage[0]!.path).toMatch(new RegExp(`^${TENANT_ID}/p-1/[0-9a-f-]{36}\\.pdf$`))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('register_document', {
      p_patient: 'p-1', p_kind: 'formulario', p_name: 'Historia clinica', p_storage_path: fakeStorage[0]!.path,
    })
    expect(await screen.findByText('Listo. Guardamos «Historia clinica».')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Documentos' })).getByText('Historia clinica')).toBeInTheDocument()
  })

  it('rechaza tipos no permitidos', async () => {
    seedPatient()
    // Sin el filtro del navegador (accept), para probar la validación propia.
    const user = await openDocsTab('owner', false)
    await user.upload(screen.getByLabelText('Elegir archivo'), new File(['x'], 'virus.exe', { type: 'application/x-msdownload' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Usa PDF, JPG, PNG, WebP o STL.')
    expect(fakeStorage).toHaveLength(0)
  }, 10000)

  it('ver un documento pide un enlace de 60 s a la Edge Function', async () => {
    seedPatient()
    seedDoc()
    const win = { opener: {}, location: { href: '' }, close: vi.fn() }
    const open = vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window)
    const user = await openDocsTab()
    await user.click(await screen.findByRole('button', { name: 'Panorámica' }))
    expect(open).toHaveBeenCalledWith('', '_blank')
    expect(fakeSupabase.functions.invoke).toHaveBeenCalledWith('document-url', { body: { document_id: 'd-1', action: 'view' } })
    await waitFor(() => expect(win.location.href).toBe('https://storage.test/firmado/d-1'))
    expect(win.opener).toBeNull()
    expect(fakeDb.document_access_log).toContainEqual({ document_id: 'd-1', action: 'view' })
  })

  it('si no hay acceso, cierra la ventana y lo explica', async () => {
    seedPatient()
    seedDoc()
    const win = { opener: {}, location: { href: '' }, close: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window)
    const user = await openDocsTab()
    fakeDb.patient_documents.length = 0 // ya no existe en la base
    await user.click(await screen.findByRole('button', { name: 'Panorámica' }))
    expect(await screen.findByText('No encontramos este documento o no tienes acceso.')).toBeInTheDocument()
    expect(win.close).toHaveBeenCalled()
  })

  it('recepción archiva; el documento se conserva', async () => {
    seedPatient()
    seedDoc()
    const user = await openDocsTab('reception')
    await user.click(await screen.findByRole('button', { name: 'Archivar Panorámica' }))
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('set_document_archived', { p_document: 'd-1', p_archived: true })
    expect(await screen.findByText('Archivamos el documento. Se conserva por ley.')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Ver archivados (1)' })).toBeInTheDocument()
  })

  it('un doctor no archiva', async () => {
    seedPatient()
    seedDoc()
    await openDocsTab('doctor')
    await screen.findByRole('button', { name: 'Panorámica' })
    expect(screen.queryByRole('button', { name: 'Archivar Panorámica' })).not.toBeInTheDocument()
  })
})
