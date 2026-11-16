-- =============================================================================
-- ROLLBACK de 20261116000500_patient_documents.sql
-- DESTRUCTIVO: borra el registro de documentos y su bitácora (datos de salud con
-- retención legal). El bucket debe estar VACÍO (los archivos se borran antes desde
-- la API de Storage). SOLO en desarrollo con datos ficticios y con aprobación de Diego.
-- =============================================================================
begin;

drop policy if exists patient_documents_insert on storage.objects;
drop function if exists public.set_document_archived(uuid, boolean);
drop function if exists public.authorize_document_access(uuid, text);
drop function if exists public.register_document(uuid, public.document_kind, text, text);
drop table if exists public.document_access_log;
drop table if exists public.patient_documents;
drop function if exists private.can_upload_document(text);
drop function if exists private.document_patient(text);
drop function if exists private.is_document_path(uuid, uuid, text);
drop type if exists public.document_kind;

set local storage.allow_delete_query = 'true';
delete from storage.buckets where id = 'patient-documents';

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20261116000500';
  end if;
end $$;

commit;
