-- =============================================================================
-- 0022 · Reportes del equipo (E3 · M6-B2b)
--
-- Reglas (aprobadas por Diego el 2026-11-24):
--   * Solo la dueña o el dueño (rol owner) ve los reportes y el historial de un doctor.
--     La administración, recepción, los doctores, otra clínica y el superadmin no (42501
--     en el reporte de la clínica; P0002 en el historial, para no revelar el registro).
--   * Presupuestos por doctor (obs. 11), por la fecha en que se presentaron
--     (sent_at; si no tiene, la de creación), en la zona horaria de la clínica:
--       presentados  = todo lo que no es borrador
--       aceptados    = aceptado, en tratamiento o terminado
--       en espera    = presentado o en duda
--       sin completar = aceptado o en tratamiento
--       perdidos     = perdido
--     Cada grupo con cantidad y monto. Los presupuestos sin doctor salen en una fila aparte.
--   * Historial del doctor: citas atendidas (llegó), faltas y canceladas del periodo;
--     pacientes atendidos (distintos, con cita «llegó»); cobrado (pagos no anulados
--     atribuidos al doctor); comisiones (movimientos no anulados del periodo); sus
--     presupuestos con los mismos grupos; las próximas 10 citas (siempre, desde ahora) y
--     las últimas 10 del periodo. Solo nombres de pacientes, sin notas clínicas.
--   * Periodo de hasta 400 días (22023), como el resto de los reportes.
--   * Cada movimiento de comisión dice con qué esquema se calculó (obs. 18): commission_lines
--     agrega scheme_kind (% o renta) del esquema que generó el movimiento; mismos permisos.
--   * Solo lectura: no escribe nada ni cambia permisos de tablas.
-- Rollback: supabase/rollback/20261124000400_doctor_reports.down.sql
-- =============================================================================

-- Agrupa los presupuestos de un conjunto (cantidad y monto por grupo).
create or replace function private.quote_groups(p_tenant uuid, p_doctor uuid, p_all boolean, p_from date, p_to date)
returns table (
  doctor_id uuid,
  presented integer, presented_amount numeric,
  accepted integer, accepted_amount numeric,
  waiting integer, waiting_amount numeric,
  unfinished integer, unfinished_amount numeric,
  lost integer, lost_amount numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select q.doctor_id,
    count(*)::integer, coalesce(sum(q.total), 0),
    (count(*) filter (where q.status in ('aceptado', 'en_tratamiento', 'terminado')))::integer,
    coalesce(sum(q.total) filter (where q.status in ('aceptado', 'en_tratamiento', 'terminado')), 0),
    (count(*) filter (where q.status in ('presentado', 'en_duda')))::integer,
    coalesce(sum(q.total) filter (where q.status in ('presentado', 'en_duda')), 0),
    (count(*) filter (where q.status in ('aceptado', 'en_tratamiento')))::integer,
    coalesce(sum(q.total) filter (where q.status in ('aceptado', 'en_tratamiento')), 0),
    (count(*) filter (where q.status = 'perdido'))::integer,
    coalesce(sum(q.total) filter (where q.status = 'perdido'), 0)
  from public.quotes q
  where q.tenant_id = p_tenant and q.status <> 'borrador'
    and (p_all or q.doctor_id = p_doctor)
    and (coalesce(q.sent_at, q.created_at) at time zone private.tenant_tz(p_tenant))::date between p_from and p_to
  group by q.doctor_id
$$;

-- Reporte de presupuestos por doctor (pestaña «Reportes»). Solo la dueña o el dueño.
create or replace function public.doctor_quote_report(p_tenant uuid, p_from date, p_to date)
returns table (
  doctor_id uuid, full_name text, role public.tenant_role,
  presented integer, presented_amount numeric,
  accepted integer, accepted_amount numeric,
  waiting integer, waiting_amount numeric,
  unfinished integer, unfinished_amount numeric,
  lost integer, lost_amount numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_uid();
  if not private.has_role(p_tenant, array['owner']::public.tenant_role[]) then
    raise exception 'Sin acceso' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'Revisa el periodo' using errcode = '22023';
  end if;
  return query
    with g as (select * from private.quote_groups(p_tenant, null, true, p_from, p_to)),
    docs as (
      select m.id, m.role, coalesce(nullif(btrim(m.display_name), ''), nullif(btrim(pr.full_name), ''), 'Sin nombre') as name
      from public.memberships m
      left join public.profiles pr on pr.id = m.user_id
      where m.tenant_id = p_tenant
        and ((m.status = 'active' and m.role in ('owner', 'admin', 'doctor', 'doctor_collab'))
             or m.id in (select g.doctor_id from g where g.doctor_id is not null))
    )
    select d.id, d.name, d.role,
      coalesce(g.presented, 0), coalesce(g.presented_amount, 0),
      coalesce(g.accepted, 0), coalesce(g.accepted_amount, 0),
      coalesce(g.waiting, 0), coalesce(g.waiting_amount, 0),
      coalesce(g.unfinished, 0), coalesce(g.unfinished_amount, 0),
      coalesce(g.lost, 0), coalesce(g.lost_amount, 0)
    from docs d
    left join g on g.doctor_id = d.id
    union all
    select null::uuid, 'Sin doctor', null::public.tenant_role,
      g.presented, g.presented_amount, g.accepted, g.accepted_amount, g.waiting, g.waiting_amount,
      g.unfinished, g.unfinished_amount, g.lost, g.lost_amount
    from g where g.doctor_id is null
    order by 5 desc, 2
    limit 200;
end;
$$;

-- Historial de un doctor (perfil en Tu equipo). Solo la dueña o el dueño de su clínica.
create or replace function public.doctor_history(p_doctor uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_m public.memberships;
  v_tz text;
begin
  perform private.require_uid();
  select * into v_m from public.memberships where id = p_doctor;
  if v_m.id is null or not private.has_role(v_m.tenant_id, array['owner']::public.tenant_role[]) then
    raise exception 'Doctor no encontrado' using errcode = 'P0002';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'Revisa el periodo' using errcode = '22023';
  end if;
  v_tz := private.tenant_tz(v_m.tenant_id);
  return (
    with a as (
      select ap.id, ap.starts_at, ap.ends_at, ap.status, ap.kind, ap.patient_id, pt.full_name as patient, t.name as treatment
      from public.appointments ap
      join public.patients pt on pt.tenant_id = ap.tenant_id and pt.id = ap.patient_id
      left join public.treatments t on t.tenant_id = ap.tenant_id and t.id = ap.treatment_id
      where ap.tenant_id = v_m.tenant_id and ap.doctor_id = v_m.id
    ),
    ap as (select * from a where (a.starts_at at time zone v_tz)::date between p_from and p_to),
    qg as (select * from private.quote_groups(v_m.tenant_id, v_m.id, false, p_from, p_to))
    select jsonb_build_object(
      'appointments', jsonb_build_object(
        'attended', (select count(*) from ap where ap.status = 'llego'),
        'no_show', (select count(*) from ap where ap.status = 'no_asistio'),
        'cancelled', (select count(*) from ap where ap.status = 'cancelada'),
        'total', (select count(*) from ap)
      ),
      'patients', (select count(distinct ap.patient_id) from ap where ap.status = 'llego'),
      'collected', coalesce((
        select sum(x.amount) from public.payments x
        where x.tenant_id = v_m.tenant_id and x.doctor_id = v_m.id and x.voided_at is null
          and (x.paid_at at time zone v_tz)::date between p_from and p_to), 0),
      'commission', coalesce((
        select sum(e.amount) from public.commission_entries e
        where e.tenant_id = v_m.tenant_id and e.doctor_id = v_m.id and e.voided_at is null
          and e.period_date between p_from and p_to), 0),
      'quotes', coalesce((select to_jsonb(qg) - 'doctor_id' from qg limit 1), jsonb_build_object(
        'presented', 0, 'presented_amount', 0, 'accepted', 0, 'accepted_amount', 0, 'waiting', 0, 'waiting_amount', 0,
        'unfinished', 0, 'unfinished_amount', 0, 'lost', 0, 'lost_amount', 0)),
      'upcoming', coalesce((
        select jsonb_agg(jsonb_build_object('id', u.id, 'starts_at', u.starts_at, 'status', u.status, 'kind', u.kind,
          'patient', u.patient, 'treatment', u.treatment) order by u.starts_at)
        from (select * from a where a.starts_at >= now() and a.status in ('programada', 'confirmada')
              order by a.starts_at limit 10) u), '[]'::jsonb),
      'recent', coalesce((
        select jsonb_agg(jsonb_build_object('id', r.id, 'starts_at', r.starts_at, 'status', r.status, 'kind', r.kind,
          'patient', r.patient, 'treatment', r.treatment) order by r.starts_at desc)
        from (select * from ap where ap.starts_at < now() order by ap.starts_at desc limit 10) r), '[]'::jsonb)
    )
  );
end;
$$;

-- Movimientos con el tipo de esquema con que se calcularon (obs. 18).
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

revoke all on function private.quote_groups(uuid, uuid, boolean, date, date) from public, anon, authenticated;
revoke all on function public.doctor_quote_report(uuid, date, date) from public, anon;
grant execute on function public.doctor_quote_report(uuid, date, date) to authenticated;
revoke all on function public.doctor_history(uuid, date, date) from public, anon;
grant execute on function public.doctor_history(uuid, date, date) to authenticated;
