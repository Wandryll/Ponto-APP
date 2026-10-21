begin;

create or replace function public.prevent_rapid_checkpoints()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  previous_type text;
  work_date date;
  day_start timestamp with time zone;
  day_end timestamp with time zone;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.colaborador_id::text, 0));

  new.data_hora := now();
  work_date := (new.data_hora at time zone 'America/Manaus')::date;
  day_start := work_date::timestamp at time zone 'America/Manaus';
  day_end := (work_date + 1)::timestamp at time zone 'America/Manaus';

  if exists (
    select 1
    from public.registros_acesso
    where colaborador_id = new.colaborador_id
      and data_hora > new.data_hora - interval '30 seconds'
  ) then
    raise exception 'Aguarde antes de registrar novamente';
  end if;

  select tipo into previous_type
  from public.registros_acesso
  where colaborador_id = new.colaborador_id
    and data_hora >= day_start
    and data_hora < day_end
  order by data_hora desc, id desc
  limit 1;

  if (previous_type is null and new.tipo <> 'CHECKIN')
     or previous_type = new.tipo then
    raise exception 'Sequência de registro inválida para o dia atual';
  end if;

  return new;
end;
$$;

commit;
