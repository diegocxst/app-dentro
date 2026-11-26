-- =============================================================================
-- ROLLBACK de 20261126000100_treatment_commissions.sql
-- SOLO en desarrollo con datos ficticios y con aprobación explícita de Diego. NUNCA en
-- producción. Se niega si ya hay movimientos calculados por tratamiento (se perdería con
-- qué regla se calcularon). Se pierden las excepciones por tratamiento.
-- =============================================================================
begin;

do $$
begin
  if exists (select 1 from public.commission_entries where treatment_id is not null) then
    raise exception 'Hay movimientos calculados por tratamiento: no se puede revertir';
  end if;
end $$;

drop function if exists public.set_treatment_commission(uuid, uuid, numeric, numeric);

-- commission_lines vuelve a la versión de la 0022.
create or replace function public.commission_lines(p_doctor uuid, p_from date, p_to date, p_limit integer default 50, p_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_m public.memberships;
begin
  perform private.require_uid();
  select * into v_m from public.memberships where id = p_doctor;
  if v_m.id is null or not private.can_see_commissions(v_m.tenant_id, v_m.id) then
    raise exception 'Doctor no encontrado' using errcode = 'P0002';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'Revisa el periodo' using errcode = '22023';
  end if;
  return (
    with l as (
      select e.id, e.kind, e.base, e.rate, e.amount, e.period_date, e.payout_id is not null as paid, s.kind as scheme_kind,
        x.folio, x.method, pt.full_name as patient, q.title as quote_title, q.folio as quote_folio
      from public.commission_entries e
      join public.payments x on x.tenant_id = e.tenant_id and x.id = e.payment_id
      join public.patients pt on pt.tenant_id = x.tenant_id and pt.id = x.patient_id
      left join public.quotes q on q.tenant_id = x.tenant_id and q.id = x.quote_id
      left join public.commission_schemes s on s.tenant_id = e.tenant_id and s.id = e.scheme_id
      where e.tenant_id = v_m.tenant_id and e.doctor_id = v_m.id and e.voided_at is null
        and e.period_date between p_from and p_to
    )
    select jsonb_build_object(
      'total', (select count(*) from l),
      'rows', coalesce((select jsonb_agg(to_jsonb(r) order by r.period_date desc, r.folio desc)
        from (select * from l order by period_date desc, folio desc
              limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0)) r), '[]'::jsonb)
    )
  );
end;
$$;

-- Triggers vuelven a la versión de la 0017.
create or replace function private.commission_on_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.commission_schemes;
  v_rate numeric;
begin
  if new.doctor_id is null or new.voided_at is not null then
    return null;
  end if;
  select * into v_s from public.commission_schemes
  where tenant_id = new.tenant_id and membership_id = new.doctor_id and ended_at is null;
  if v_s.id is null then
    return null;
  end if;
  v_rate := case when v_s.kind = 'percent_collected' then v_s.percent else 100 end;
  insert into public.commission_entries (tenant_id, doctor_id, payment_id, scheme_id, kind, base, rate, amount, period_date)
  values (new.tenant_id, new.doctor_id, new.id, v_s.id, 'comision', new.amount, v_rate, round(new.amount * v_rate / 100, 2),
    (new.paid_at at time zone private.tenant_tz(new.tenant_id))::date);
  return null;
end;
$$;

create or replace function private.commission_on_void()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_e public.commission_entries;
begin
  select * into v_e from public.commission_entries where payment_id = new.id and kind = 'comision';
  if v_e.id is null or v_e.voided_at is not null then
    return null;
  end if;
  if v_e.payout_id is null then
    update public.commission_entries set voided_at = now() where id = v_e.id;
  else
    insert into public.commission_entries (tenant_id, doctor_id, payment_id, scheme_id, kind, base, rate, amount, period_date)
    values (v_e.tenant_id, v_e.doctor_id, v_e.payment_id, v_e.scheme_id, 'ajuste', -v_e.base, v_e.rate, -v_e.amount,
      (now() at time zone private.tenant_tz(v_e.tenant_id))::date);
  end if;
  return null;
end;
$$;

drop index if exists public.commission_entries_part_uidx;
alter table public.commission_entries
  drop constraint commission_entries_rate_check,
  drop constraint commission_entries_treatment_fk,
  drop column fixed_amount,
  drop column treatment_id,
  add constraint commission_entries_rate_check check (rate > 0 and rate <= 100),
  add constraint commission_entries_payment_id_kind_key unique (payment_id, kind);

drop table if exists public.commission_treatment_rules;

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20261126000100';
  end if;
end $$;

commit;
