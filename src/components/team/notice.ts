import type { AlertTone } from '@/components/ui/Alert'
import type { InviteOutcome } from '@/data/team'

export type Notice = { tone: AlertTone; text: string }

export function outcomeNotice(out: InviteOutcome, email: string): Notice {
  if (out === 'sent') return { tone: 'success', text: `Listo. Enviamos la invitación a ${email}.` }
  if (out === 'existing_user') return { tone: 'success', text: `${email} ya tiene cuenta en dentro. Verá tu clínica la próxima vez que entre.` }
  return { tone: 'warning', text: 'Guardamos la invitación, pero no pudimos enviar el correo. Usa «Reenviar» en un momento.' }
}
