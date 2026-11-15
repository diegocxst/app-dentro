// Edge Function `invite-member` (Deno). Solo conecta la lógica de handler.ts con Supabase.
// Variables: SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY las pone Supabase;
// SITE_URL se define con `supabase secrets set` (con aprobación de Diego).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { handleInvite } from './handler.ts'

const url = Deno.env.get('SUPABASE_URL') ?? ''
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const siteUrl = (Deno.env.get('SITE_URL') ?? '').replace(/\/+$/, '')

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

Deno.serve((req) =>
  handleInvite(req, {
    siteUrl,
    createInvitation: async (jwt, args) => {
      const asUser = createClient(url, anonKey, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const { data, error } = await asUser.rpc('create_invitation', args)
      return { data: data as { id: string } | null, error }
    },
    sendInvite: async (email, redirectTo) => {
      const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo })
      return { error }
    },
  }),
)
