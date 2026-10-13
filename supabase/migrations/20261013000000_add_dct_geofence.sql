begin;

create table if not exists public.locais_trabalho (
  id bigint generated always as identity primary key,
  nome text not null unique check (char_length(nome) between 2 and 120),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  raio_metros integer not null check (raio_metros between 10 and 1000),
  ativo boolean not null default true,
  criado_em timestamp with time zone not null default now()
);

create unique index if not exists locais_trabalho_um_ativo_idx
  on public.locais_trabalho (ativo)
  where ativo;

alter table public.locais_trabalho enable row level security;

revoke all on public.locais_trabalho from anon, authenticated;
grant select on public.locais_trabalho to authenticated;

drop policy if exists "locais_select_ativo" on public.locais_trabalho;
create policy "locais_select_ativo"
on public.locais_trabalho for select to authenticated
using (ativo);

insert into public.locais_trabalho (nome, latitude, longitude, raio_metros, ativo)
values ('DCT', -3.284848, -60.631474, 35, true)
on conflict (nome) do update
set latitude = excluded.latitude,
    longitude = excluded.longitude,
    raio_metros = excluded.raio_metros,
    ativo = excluded.ativo;

create or replace function public.distancia_metros(
  latitude_origem double precision,
  longitude_origem double precision,
  latitude_destino double precision,
  longitude_destino double precision
)
returns double precision
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select 6371000 * 2 * asin(
    sqrt(
      least(
        1,
        power(sin(radians((latitude_destino - latitude_origem) / 2)), 2)
        + cos(radians(latitude_origem))
        * cos(radians(latitude_destino))
        * power(sin(radians((longitude_destino - longitude_origem) / 2)), 2)
      )
    )
  );
$$;

revoke all on function public.distancia_metros(
  double precision,
  double precision,
  double precision,
  double precision
) from public, anon, authenticated;

create or replace function public.validar_geocerca_registro()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  local_ativo public.locais_trabalho%rowtype;
  distancia double precision;
begin
  select * into local_ativo
  from public.locais_trabalho
  where ativo
  limit 1;

  if not found then
    raise exception 'Local de trabalho não configurado';
  end if;

  distancia := public.distancia_metros(
    local_ativo.latitude,
    local_ativo.longitude,
    new.latitude::double precision,
    new.longitude::double precision
  );

  if distancia > local_ativo.raio_metros then
    raise exception 'Localização fora da área permitida';
  end if;

  return new;
end;
$$;

revoke all on function public.validar_geocerca_registro() from public, anon, authenticated;

drop trigger if exists validar_geocerca_registro on public.registros_acesso;
create trigger validar_geocerca_registro
before insert on public.registros_acesso
for each row execute function public.validar_geocerca_registro();

commit;
