import type { ConsentSource, Tables } from '@/lib/db'
import { supabase } from '@/lib/supabase'

export type PrivacyNotice = Tables<'privacy_notices'>

/** Versión vigente del aviso de privacidad de dentro. */
export async function fetchCurrentNotice(): Promise<PrivacyNotice | null> {
  const { data, error } = await supabase.from('privacy_notices').select('*').eq('is_current', true).maybeSingle()
  if (error) throw error
  return data as PrivacyNotice | null
}

/** ¿La persona ya aceptó esta versión? (RLS: solo ve sus propias aceptaciones). */
export async function hasAccepted(userId: string, noticeId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('account_consents')
    .select('id')
    .eq('user_id', userId)
    .eq('notice_id', noticeId)
    .maybeSingle()
  if (error) throw error
  return data !== null
}

export async function acceptNotice(version: string, source: ConsentSource): Promise<void> {
  const { error } = await supabase.rpc('accept_privacy_notice', { p_version: version, p_source: source })
  if (error) throw error
}
