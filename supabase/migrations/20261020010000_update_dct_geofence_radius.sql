begin;

update public.locais_trabalho
set raio_metros = 15
where nome = 'DCT';

commit;
