# Segurança

## Relato de vulnerabilidades

Não abra issues públicas com chaves, dados pessoais, fotos, localizações ou instruções completas de
exploração. Use o recurso **Report a vulnerability** na aba **Security** do repositório GitHub.

Inclua:

- descrição e impacto;
- passos mínimos para reprodução;
- rota ou componente afetado;
- versão ou commit testado;
- sugestão de correção, se houver.

## Escopo

O projeto utiliza autenticação do Supabase, RLS no PostgreSQL, políticas de Storage, validações no
banco e Edge Function para operações administrativas. A chave `service_role` não deve ser exposta
ao frontend.

## Dados pessoais

Fotos e geolocalizações não devem ser incluídas em issues, logs, fixtures, screenshots públicas ou
dumps versionados. Incidentes envolvendo esses dados devem seguir o processo interno de privacidade
e LGPD da organização.
