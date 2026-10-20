begin;

create or replace function public.relatorio_registros_admin_periodo(
  periodo_inicio timestamp with time zone,
  periodo_fim timestamp with time zone,
  limite integer default 1000,
  deslocamento integer default 0
)
returns table (
  id bigint,
  colaborador_id uuid,
  colaborador_nome text,
  colaborador_equipe text,
  tipo text,
  data_hora timestamp with time zone,
  latitude numeric,
  longitude numeric
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.colaboradores c_admin
    where c_admin.id = auth.uid()
      and c_admin.ativo
      and c_admin.is_admin
  ) then
    raise exception 'Acesso permitido somente para administradores';
  end if;

  if periodo_inicio is null
    or periodo_fim is null
    or periodo_fim <= periodo_inicio
    or periodo_fim - periodo_inicio > interval '373 days'
  then
    raise exception 'Período de relatório inválido';
  end if;

  return query
  select
    r.id,
    r.colaborador_id,
    c.nome,
    coalesce(c.equipe, 'Sem equipe'),
    r.tipo,
    r.data_hora,
    r.latitude,
    r.longitude
  from public.registros_acesso r
  join public.colaboradores c on c.id = r.colaborador_id
  where r.data_hora >= periodo_inicio
    and r.data_hora < periodo_fim
  order by r.data_hora asc, r.id asc
  limit least(greatest(coalesce(limite, 1000), 1), 1000)
  offset greatest(coalesce(deslocamento, 0), 0);
end;
$$;

revoke all on function public.relatorio_registros_admin_periodo(
  timestamp with time zone,
  timestamp with time zone,
  integer,
  integer
) from public, anon;

grant execute on function public.relatorio_registros_admin_periodo(
  timestamp with time zone,
  timestamp with time zone,
  integer,
  integer
) to authenticated;

commit;
