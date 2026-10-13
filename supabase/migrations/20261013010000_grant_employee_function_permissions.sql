begin;

grant select on public.colaboradores to service_role;
grant insert (id, nome, cargo, email, equipe, ativo, data_admissao, avatar, is_admin)
  on public.colaboradores to service_role;
grant update on public.colaboradores to service_role;

grant select, insert on public.registros_acesso to authenticated;
grant usage on sequence public.registros_acesso_id_seq to authenticated;

commit;
