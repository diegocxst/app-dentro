-- =============================================================================
-- ROLLBACK de 20261124000400_doctor_reports.sql
-- SOLO en desarrollo con datos ficticios y con aprobación explícita de Diego. NUNCA en
-- producción. Son funciones de solo lectura: no se pierde ningún dato.
-- =============================================================================
begin;

drop function if exists public.doctor_history(uuid, date, date);
drop function if exists public.doctor_quote_report(uuid, date, date);
drop function if exists private.quote_groups(uuid, uuid, boolean, date, date);

-- commission_lines vuelve a su versión de la 0017 (sin scheme_kind).
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
      select e.id, e.kind, e.base, e.rate, e.amount, e.period_date, e.payout_id is not null as paid,
        x.folio, x.method, pt.full_name as patient, q.title as quote_title, q.folio as quote_folio
      from public.commission_entries e
      join public.payments x on x.tenant_id = e.tenant_id and x.id = e.payment_id
      join public.patients pt on pt.tenant_id = x.tenant_id and pt.id = x.patient_id
      left join public.quotes q on q.tenant_id = x.tenant_id and q.id = x.quote_id
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

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20261124000400';
  end if;
end $$;

commit;
