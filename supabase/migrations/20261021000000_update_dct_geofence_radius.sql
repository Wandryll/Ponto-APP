begin;

update public.locais_trabalho
set raio_metros = 20
where nome = 'DCT';

commit;
