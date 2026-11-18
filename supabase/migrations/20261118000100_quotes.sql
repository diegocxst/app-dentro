-- =============================================================================
-- 0015 · Presupuestos (E3 · M4-A)
--
-- Reglas (aprobadas por Diego el 2026-11-18):
--   * Los crean y ven la dueña, la administración y recepción (de cualquier paciente)
--     y el doctor (solo de sus pacientes; él queda como doctor del presupuesto). Igual
--     que Pacientes. El superadmin no los ve.
--   * Folio por clínica (P-0001, P-0002…). Partidas del catálogo o libres; una
--     partida con precio negativo es un descuento. El total nunca es negativo.
--   * Plan de pagos: contado (sin mensualidades) o anticipo + N mensualidades.
--   * Precio final en MXN, sin desglose de IVA (CFDI en Fase 2).
--   * Etapas: borrador → presentado ⇄ en duda → aceptado → en tratamiento → terminado;
--     cualquiera abierta → perdido (con motivo); perdido → presentado (reabrir).
--     Solo se edita en borrador, presentado o en duda.
--   * Sin borrado. Auditoría sin montos ni datos del paciente.
-- Rollback: supabase/rollback/20261118000100_quotes.down.sql
-- =============================================================================

create type public.quote_status as enum ('borrador', 'presentado', 'en_duda', 'aceptado', 'en_tratamiento', 'terminado', 'perdido');

alter table public.tenants add column quote_seq integer not null default 0 check (quote_seq >= 0);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  folio integer not null check (folio > 0),
  patient_id uuid not null,
  doctor_id uuid,
  title text not null default '' check (char_length(title) <= 120),
  status public.quote_status not null default 'borrador',
  total numeric(12, 2) not null default 0 check (total >= 0 and total <= 10000000),
  down_payment numeric(12, 2) not null default 0 check (down_payment >= 0),
  installments integer not null default 0 check (installments between 0 and 60),
  valid_until date not null default (current_date + 30),
  notes text check (char_length(notes) <= 1000),
  lost_reason text check (char_length(lost_reason) <= 300),
  sent_at timestamptz,
  last_followup_at timestamptz,
  status_changed_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, folio),
  foreign key (tenant_id, patient_id) references public.patients (tenant_id, id) on delete cascade,
  foreign key (tenant_id, doctor_id) references public.memberships (tenant_id, id),
  check (down_payment <= total),
  -- Con mensualidades hay un anticipo (puede ser 0); de contado no se financia nada.
  check (installments > 0 or down_payment = 0),
  check (status <> 'perdido' or coalesce(char_length(btrim(lost_reason)), 0) > 0)
);
create index quotes_tenant_status_idx on public.quotes (tenant_id, status, status_changed_at desc);
create index quotes_patient_idx on public.quotes (tenant_id, patient_id, created_at desc);
create index quotes_doctor_idx on public.quotes (tenant_id, doctor_id);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  quote_id uuid not null,
  position integer not null check (position between 0 and 99),
  treatment_id uuid,
  concept text not null check (char_length(btrim(concept)) between 1 and 160),
  note text not null default '' check (char_length(note) <= 160),
  quantity integer not null default 1 check (quantity between 1 and 99),
  unit_price numeric(12, 2) not null check (unit_price between -10000000 and 10000000),
  foreign key (tenant_id, quote_id) references public.quotes (tenant_id, id) on delete cascade,
  foreign key (tenant_id, treatment_id) references public.treatments (tenant_id, id),
  unique (quote_id, position)
);
create index quote_items_quote_idx on public.quote_items (tenant_id, quote_id, position);

create trigger quotes_set_updated_at before update on public.quotes
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- Quien puede escribir el presupuesto (ve al paciente y escribe en su clínica). Lo devuelve.
create or replace function private.require_quote_writer(p_quote uuid)
returns public.quotes
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q public.quotes;
begin
  perform private.require_uid();
  select * into v_q from public.quotes where id = p_quote;
  if v_q.id is null or not private.can_see_patient_id(v_q.patient_id) then
    raise exception 'Presupuesto no encontrado' using errcode = 'P0002';
  end if;
  if not private.can_write(v_q.tenant_id, array['owner', 'admin', 'reception', 'doctor', 'doctor_collab']::public.tenant_role[]) then
    raise exception 'Tu clínica está en solo lectura' using errcode = '42501';
  end if;
  return v_q;
end;
$$;

revoke all on function private.require_quote_writer(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- RPC
-- -----------------------------------------------------------------------------

-- Crea (p_quote NULL) o edita un presupuesto con todas sus partidas (las reemplaza).
-- p_items: [{ "treatment_id"?: uuid, "concept": text, "note"?: text, "quantity": int, "unit_price": number }]
create or replace function public.save_quote(
  p_quote uuid,
  p_patient uuid,
  p_doctor uuid,
  p_items jsonb,
  p_title text default '',
  p_down_payment numeric default 0,
  p_installments integer default 0,
  p_valid_until date default null,
  p_notes text default null
)
returns public.quotes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.patients;
  v_me public.memberships;
  v_q public.quotes;
  v_doctor uuid := p_doctor;
  v_item jsonb;
  v_pos integer := 0;
  v_total numeric(12, 2);
begin
  perform private.require_uid();
  if p_quote is not null then
    v_q := private.require_quote_writer(p_quote);
    if v_q.status not in ('borrador', 'presentado', 'en_duda') then
      raise exception 'Un presupuesto aceptado ya no se edita' using errcode = '22023';
    end if;
    if v_q.patient_id <> p_patient then
      raise exception 'No se cambia el paciente de un presupuesto' using errcode = '22023';
    end if;
  end if;

  select * into v_p from public.patients where id = p_patient;
  if v_p.id is null or not private.can_see_patient(v_p.tenant_id, v_p.primary_doctor_id) then
    raise exception 'Paciente no encontrado' using errcode = 'P0002';
  end if;
  if not private.can_write(v_p.tenant_id, array['owner', 'admin', 'reception', 'doctor', 'doctor_collab']::public.tenant_role[]) then
    raise exception 'No tienes permiso para hacer presupuestos' using errcode = '42501';
  end if;
  v_me := private.my_membership(v_p.tenant_id);
  if v_me.role in ('doctor', 'doctor_collab') then
    v_doctor := v_me.id;
  end if;
  if not private.valid_doctor(v_p.tenant_id, v_doctor) then
    raise exception 'El doctor no es parte del equipo' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'Agrega al menos un tratamiento' using errcode = '22023';
  end if;

  select coalesce(sum(round((i ->> 'quantity')::integer * (i ->> 'unit_price')::numeric, 2)), 0) into v_total
  from jsonb_array_elements(p_items) i;
  if v_total < 0 then
    raise exception 'El total no puede ser negativo' using errcode = '22023';
  end if;
  if coalesce(p_installments, 0) > 0 and (coalesce(p_down_payment, 0) < 0 or p_down_payment > v_total) then
    raise exception 'El anticipo no puede ser mayor al total' using errcode = '22023';
  end if;

  if p_quote is null then
    update public.tenants set quote_seq = quote_seq + 1 where id = v_p.tenant_id returning quote_seq into v_pos;
    insert into public.quotes (tenant_id, folio, patient_id, doctor_id, title, total, down_payment, installments, valid_until, notes, created_by)
    values (v_p.tenant_id, v_pos, v_p.id, v_doctor, btrim(coalesce(p_title, '')), v_total,
      case when coalesce(p_installments, 0) > 0 then coalesce(p_down_payment, 0) else 0 end,
      coalesce(p_installments, 0), coalesce(p_valid_until, current_date + 30), nullif(btrim(p_notes), ''), (select auth.uid()))
    returning * into v_q;
  else
    update public.quotes set
      doctor_id = v_doctor,
      title = btrim(coalesce(p_title, '')),
      total = v_total,
      down_payment = case when coalesce(p_installments, 0) > 0 then coalesce(p_down_payment, 0) else 0 end,
      installments = coalesce(p_installments, 0),
      valid_until = coalesce(p_valid_until, valid_until),
      notes = nullif(btrim(p_notes), '')
    where id = p_quote
    returning * into v_q;
    delete from public.quote_items where quote_id = v_q.id;
  end if;

  v_pos := 0;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if nullif(v_item ->> 'treatment_id', '') is not null and not exists (
      select 1 from public.treatments t where t.id = (v_item ->> 'treatment_id')::uuid and t.tenant_id = v_q.tenant_id
    ) then
      raise exception 'Tratamiento no encontrado' using errcode = 'P0002';
    end if;
    insert into public.quote_items (tenant_id, quote_id, position, treatment_id, concept, note, quantity, unit_price)
    values (v_q.tenant_id, v_q.id, v_pos, nullif(v_item ->> 'treatment_id', '')::uuid, btrim(v_item ->> 'concept'),
      btrim(coalesce(v_item ->> 'note', '')), (v_item ->> 'quantity')::integer, (v_item ->> 'unit_price')::numeric);
    v_pos := v_pos + 1;
  end loop;

  perform private.write_audit(v_q.tenant_id, case when p_quote is null then 'quote.created' else 'quote.updated' end, 'quote', v_q.id::text);
  return v_q;
end;
$$;

-- Mover de etapa. Presentar exige partidas y total; perdido exige motivo.
create or replace function public.set_quote_status(p_quote uuid, p_status public.quote_status, p_reason text default null)
returns public.quotes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_q public.quotes := private.require_quote_writer(p_quote);
  v_from public.quote_status := v_q.status;
  v_ok boolean;
begin
  if p_status = v_from then
    return v_q;
  end if;
  v_ok := case p_status
    when 'presentado' then v_from in ('borrador', 'en_duda', 'perdido')
    when 'en_duda' then v_from = 'presentado'
    when 'aceptado' then v_from in ('presentado', 'en_duda')
    when 'en_tratamiento' then v_from = 'aceptado'
    when 'terminado' then v_from = 'en_tratamiento'
    when 'perdido' then v_from in ('borrador', 'presentado', 'en_duda', 'aceptado')
    when 'borrador' then false
  end;
  if not v_ok then
    raise exception 'Ese cambio de etapa no es posible' using errcode = '22023';
  end if;
  if p_status = 'presentado' and v_q.total <= 0 then
    raise exception 'Agrega tratamientos con precio antes de presentarlo' using errcode = '22023';
  end if;
  if p_status = 'perdido' and coalesce(btrim(p_reason), '') = '' then
    raise exception 'Escribe por qué se perdió' using errcode = '22023';
  end if;

  update public.quotes set
    status = p_status,
    lost_reason = case when p_status = 'perdido' then btrim(p_reason) end,
    sent_at = case when p_status = 'presentado' then coalesce(sent_at, now()) else sent_at end,
    status_changed_at = now()
  where id = p_quote
  returning * into v_q;

  perform private.write_audit(v_q.tenant_id, 'quote.status', 'quote', v_q.id::text, jsonb_build_object('status', p_status));
  return v_q;
end;
$$;

-- Registrar un seguimiento (llamada o mensaje): reinicia el contador «sin respuesta».
create or replace function public.mark_quote_followup(p_quote uuid)
returns public.quotes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_q public.quotes := private.require_quote_writer(p_quote);
begin
  update public.quotes set last_followup_at = now() where id = p_quote returning * into v_q;
  perform private.write_audit(v_q.tenant_id, 'quote.followup', 'quote', v_q.id::text);
  return v_q;
end;
$$;

-- Indicadores del Kanban (maqueta P18), desde p_since; opcional por doctor.
create or replace function public.quote_stats(p_tenant uuid, p_since timestamptz, p_doctor uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_out jsonb;
begin
  perform private.require_uid();
  if not private.is_member(p_tenant) then
    raise exception 'Sin acceso' using errcode = '42501';
  end if;
  with mine as (
    select q.* from public.quotes q
    join public.patients p on p.tenant_id = q.tenant_id and p.id = q.patient_id
    where q.tenant_id = p_tenant
      and private.can_see_patient(p.tenant_id, p.primary_doctor_id)
      and (p_doctor is null or q.doctor_id = p_doctor)
  )
  select jsonb_build_object(
    'won', count(*) filter (where created_at >= p_since and status in ('aceptado', 'en_tratamiento', 'terminado')),
    'decided', count(*) filter (where created_at >= p_since and status in ('aceptado', 'en_tratamiento', 'terminado', 'perdido')),
    'in_doubt_total', coalesce(sum(total) filter (where status = 'en_duda'), 0),
    'avg_ticket', round(coalesce(avg(total) filter (where created_at >= p_since and status in ('aceptado', 'en_tratamiento', 'terminado')), 0))
  ) into v_out
  from mine;
  return v_out;
end;
$$;

revoke all on function public.save_quote(uuid, uuid, uuid, jsonb, text, numeric, integer, date, text) from public, anon;
grant execute on function public.save_quote(uuid, uuid, uuid, jsonb, text, numeric, integer, date, text) to authenticated;
revoke all on function public.set_quote_status(uuid, public.quote_status, text) from public, anon;
grant execute on function public.set_quote_status(uuid, public.quote_status, text) to authenticated;
revoke all on function public.mark_quote_followup(uuid) from public, anon;
grant execute on function public.mark_quote_followup(uuid) to authenticated;
revoke all on function public.quote_stats(uuid, timestamptz, uuid) from public, anon;
grant execute on function public.quote_stats(uuid, timestamptz, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS: los ve quien ve al paciente. Escritura solo por RPC.
-- -----------------------------------------------------------------------------
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
revoke all on public.quotes, public.quote_items from anon, authenticated;
grant select on public.quotes, public.quote_items to authenticated;

create policy quotes_select on public.quotes
  for select to authenticated
  using ((select private.can_see_patient_id(patient_id)));

create policy quote_items_select on public.quote_items
  for select to authenticated
  using (exists (select 1 from public.quotes q where q.id = quote_id and (select private.can_see_patient_id(q.patient_id))));
