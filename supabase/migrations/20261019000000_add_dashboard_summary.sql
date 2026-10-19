begin;

create or replace function public.dashboard_resumo()
returns table (
  funcionarios_ativos bigint,
  checkins_hoje bigint,
  checkouts_hoje bigint,
  presentes bigint,
  sem_checkin bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  inicio_dia timestamp with time zone;
  fim_dia timestamp with time zone;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.colaboradores
    where id = auth.uid() and ativo
  ) then
    raise exception 'Usuário não autorizado';
  end if;

  inicio_dia := date_trunc('day', now() at time zone 'America/Manaus')
    at time zone 'America/Manaus';
  fim_dia := inicio_dia + interval '1 day';

  return query
  with ativos as (
    select id
    from public.colaboradores
    where ativo
  ),
  registros_hoje as (
    select r.colaborador_id, r.tipo, r.data_hora
    from public.registros_acesso r
    join ativos a on a.id = r.colaborador_id
    where r.data_hora >= inicio_dia and r.data_hora < fim_dia
  ),
  ultimo_registro as (
    select distinct on (colaborador_id) colaborador_id, tipo
    from registros_hoje
    order by colaborador_id, data_hora desc
  )
  select
    (select count(*) from ativos),
    (select count(distinct colaborador_id) from registros_hoje where tipo = 'CHECKIN'),
    (select count(distinct colaborador_id) from registros_hoje where tipo = 'CHECKOUT'),
    (select count(*) from ultimo_registro where tipo = 'CHECKIN'),
    (select count(*) from ativos) -
      (select count(distinct colaborador_id) from registros_hoje where tipo = 'CHECKIN');
end;
$$;

revoke all on function public.dashboard_resumo() from public, anon;
grant execute on function public.dashboard_resumo() to authenticated;

commit;
