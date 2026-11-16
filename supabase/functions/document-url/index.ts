// Edge Function `document-url` (Deno). Solo conecta handler.ts con Supabase.
// SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY las pone Supabase; SITE_URL es un secreto.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { handleDocumentUrl } from './handler.ts'

const url = Deno.env.get('SUPABASE_URL') ?? ''
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const siteUrl = (Deno.env.get('SITE_URL') ?? '').replace(/\/+$/, '')

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

Deno.serve((req) =>
  handleDocumentUrl(req, {
    siteUrl,
    authorize: async (jwt, args) => {
      const asUser = createClient(url, anonKey, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const { data, error } = await asUser.rpc('authorize_document_access', args)
      return { data: data as { storage_path: string; name: string; mime: string } | null, error }
    },
    sign: async (path, seconds, downloadName) => {
      const { data, error } = await admin.storage
        .from('patient-documents')
        .createSignedUrl(path, seconds, downloadName ? { download: downloadName } : undefined)
      return { url: data?.signedUrl ?? null, error }
    },
  }),
)
