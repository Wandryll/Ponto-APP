begin;

alter table public.colaboradores alter column is_admin set default false;
alter table public.colaboradores alter column ativo set default true;
update public.colaboradores set is_admin = false where is_admin is null;
update public.colaboradores set ativo = true where ativo is null;
alter table public.colaboradores alter column is_admin set not null;
alter table public.colaboradores alter column ativo set not null;

create unique index if not exists colaboradores_email_lower_idx
  on public.colaboradores (lower(email));
create index if not exists registros_colaborador_data_idx
  on public.registros_acesso (colaborador_id, data_hora desc);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select c.is_admin and c.ativo from public.colaboradores c where c.id = auth.uid()),
    false
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.prevent_rapid_checkpoints()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1 from public.registros_acesso
    where colaborador_id = new.colaborador_id
      and data_hora > now() - interval '30 seconds'
  ) then
    raise exception 'Aguarde antes de registrar novamente';
  end if;
  return new;
end;
$$;
drop trigger if exists prevent_rapid_checkpoints on public.registros_acesso;
create trigger prevent_rapid_checkpoints
before insert on public.registros_acesso
for each row execute function public.prevent_rapid_checkpoints();

alter table public.colaboradores enable row level security;
alter table public.registros_acesso enable row level security;

do $$ declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'colaboradores'
  loop execute format('drop policy if exists %I on public.colaboradores', p.policyname); end loop;
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'registros_acesso'
  loop execute format('drop policy if exists %I on public.registros_acesso', p.policyname); end loop;
end $$;

create policy "colaboradores_select_proprio_ou_admin"
on public.colaboradores for select to authenticated
using (id = auth.uid() or public.is_admin());

create policy "colaboradores_update_proprio"
on public.colaboradores for update to authenticated
using (id = auth.uid() and ativo)
with check (id = auth.uid() and ativo);

create policy "colaboradores_update_admin"
on public.colaboradores for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "registros_select_proprio_ou_admin"
on public.registros_acesso for select to authenticated
using (colaborador_id = auth.uid() or public.is_admin());

create policy "registros_insert_proprio"
on public.registros_acesso for insert to authenticated
with check (
  colaborador_id = auth.uid()
  and exists (select 1 from public.colaboradores c where c.id = auth.uid() and c.ativo)
  and data_hora between now() - interval '1 minute' and now() + interval '1 minute'
  and latitude between -90 and 90
  and longitude between -180 and 180
  and foto_path ~ ('^' || auth.uid()::text || '/[0-9]+\.jpg$')
);

revoke all on public.colaboradores from anon, authenticated;
revoke all on public.registros_acesso from anon, authenticated;
grant select on public.colaboradores to authenticated;
grant update (nome, avatar) on public.colaboradores to authenticated;
grant update (nome, cargo, email, equipe, ativo, data_admissao, avatar, is_admin)
  on public.colaboradores to service_role;
grant select, insert on public.registros_acesso to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos_ponto', 'fotos_ponto', false, 2097152, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg'];

do $$ declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'storage' and tablename = 'objects'
             and (qual ilike '%fotos_ponto%' or with_check ilike '%fotos_ponto%')
  loop execute format('drop policy if exists %I on storage.objects', p.policyname); end loop;
end $$;

create policy "fotos_insert_pasta_propria"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'fotos_ponto'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) = 'jpg'
);
create policy "fotos_select_propria_ou_admin"
on storage.objects for select to authenticated
using (
  bucket_id = 'fotos_ponto'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);
create policy "fotos_delete_propria"
on storage.objects for delete to authenticated
using (bucket_id = 'fotos_ponto' and (storage.foldername(name))[1] = auth.uid()::text);

commit;
