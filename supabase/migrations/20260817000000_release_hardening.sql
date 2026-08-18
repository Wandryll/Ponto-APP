begin;

create or replace function public.prevent_rapid_checkpoints()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  previous_type text;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.colaborador_id::text, 0));
  if exists (
    select 1 from public.registros_acesso
    where colaborador_id = new.colaborador_id
      and data_hora > now() - interval '30 seconds'
  ) then
    raise exception 'Aguarde antes de registrar novamente';
  end if;
  select tipo into previous_type
  from public.registros_acesso
  where colaborador_id = new.colaborador_id
  order by data_hora desc
  limit 1;
  if (previous_type is null and new.tipo <> 'CHECKIN')
     or previous_type = new.tipo then
    raise exception 'Sequência de registro inválida';
  end if;
  new.data_hora := now();
  return new;
end;
$$;

drop trigger if exists prevent_rapid_checkpoints on public.registros_acesso;
create trigger prevent_rapid_checkpoints
before insert on public.registros_acesso
for each row execute function public.prevent_rapid_checkpoints();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', true, 2097152, array['image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg'];

drop policy if exists "avatares_insert_proprio" on storage.objects;
drop policy if exists "avatares_update_proprio" on storage.objects;
drop policy if exists "avatares_select_proprio" on storage.objects;

create policy "avatares_insert_proprio"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatares'
  and (storage.foldername(name))[1] = auth.uid()::text
  and name = auth.uid()::text || '/avatar.jpg'
);

create policy "avatares_update_proprio"
on storage.objects for update to authenticated
using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text)
with check (
  bucket_id = 'avatares'
  and name = auth.uid()::text || '/avatar.jpg'
);

create policy "avatares_select_proprio"
on storage.objects for select to authenticated
using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);

commit;
