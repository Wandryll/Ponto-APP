begin;

create or replace function public.dashboard_atividade_recente(limite integer default 6)
returns table (
  registro_id bigint,
  colaborador_nome text,
  colaborador_equipe text,
  colaborador_avatar text,
  tipo text,
  data_hora timestamp with time zone
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.colaboradores
    where id = auth.uid() and ativo
  ) then
    raise exception 'Usuário não autorizado';
  end if;

  return query
  select
    r.id,
    c.nome,
    coalesce(c.equipe, 'Sem equipe'),
    coalesce(c.avatar, ''),
    r.tipo,
    r.data_hora
  from public.registros_acesso r
  join public.colaboradores c on c.id = r.colaborador_id
  where c.ativo
  order by r.data_hora desc
  limit least(greatest(coalesce(limite, 6), 1), 20);
end;
$$;

revoke all on function public.dashboard_atividade_recente(integer) from public, anon;
grant execute on function public.dashboard_atividade_recente(integer) to authenticated;

commit;
