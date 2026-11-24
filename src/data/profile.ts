import type { ProfileTitle } from '@/lib/identity'
import { supabase } from '@/lib/supabase'

export async function updateMyProfile(fullName: string, phoneE164: string | null, title: ProfileTitle): Promise<void> {
  const { error } = await supabase.rpc('update_my_profile', { p_full_name: fullName, p_phone_e164: phoneE164 ?? '', p_title: title })
  if (error) throw error
}
