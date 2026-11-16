import { useEffect, useState } from 'react'
import { listAppointments, type AgendaItem } from '@/data/agenda'

const DAY = 86_400_000

/** Citas del paciente: 6 meses hacia atrás y 6 hacia adelante (el servidor admite hasta 400 días). */
export function usePatientAppointments(patientId: string) {
  const [items, setItems] = useState<AgendaItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let current = true
    const now = Date.now()
    listAppointments({ patientId, from: new Date(now - 183 * DAY).toISOString(), to: new Date(now + 183 * DAY).toISOString() }).then(
      (r) => {
        if (!current) return
        setFailed(false)
        setItems(r)
      },
      () => current && setFailed(true),
    )
    return () => {
      current = false
    }
  }, [patientId, attempt])
  return { items, failed, retry: () => setAttempt((n) => n + 1) }
}

