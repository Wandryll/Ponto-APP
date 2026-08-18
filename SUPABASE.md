# Configuração do Supabase

## 1. Preparar o CLI

Instale ou execute o Supabase CLI com `npx`, autentique e vincule o projeto:

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
```

O `project-ref` aparece na URL do painel e em **Project Settings > General**.

## 2. Fazer backup

Antes de alterar um banco que já contém dados:

```bash
npx supabase db dump --linked --file backup-before-release.sql
```

Guarde o arquivo fora do repositório. Não publique dumps com dados de funcionários.

## 3. Aplicar a migration

Confira o SQL que será aplicado:

```bash
npx supabase db push --linked --dry-run
```

Depois aplique:

```bash
npx supabase db push --linked
```

Também é possível copiar, em ordem, o conteúdo dos arquivos em `supabase/migrations` para o SQL
Editor. Não use os dois métodos para as mesmas migrations sem conferir o histórico.

A migration configura RLS, permissões por coluna, validação da sequência de ponto, limitação de
uploads e os buckets `fotos_ponto` e `avatares`.

## 4. Criar o primeiro administrador

Crie o usuário em **Authentication > Users > Add user** e confirme o e-mail. Em seguida, execute
no SQL Editor, substituindo os valores:

```sql
insert into public.colaboradores (
  id, nome, cargo, email, equipe, ativo, data_admissao, avatar, is_admin
)
select
  id,
  'Nome do administrador',
  'Administrador',
  email,
  'Administração',
  true,
  current_date,
  '',
  true
from auth.users
where lower(email) = lower('admin@empresa.com')
on conflict (id) do update set is_admin = true, ativo = true;
```

Depois disso, novos usuários podem ser criados pela tela **Equipe**.

## 5. Publicar a Edge Function

Defina a origem exata do site. Para desenvolvimento remoto, use a URL de homologação; em
produção, use o domínio definitivo e não inclua barra no final:

```bash
npx supabase secrets set APP_ORIGIN=https://ponto.suaempresa.com --project-ref SEU_PROJECT_REF
npx supabase functions deploy create-employee --project-ref SEU_PROJECT_REF
```

O Supabase fornece `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` ao runtime da
função. A `service_role` nunca deve ir para `.env`, GitHub, Vercel ou código do navegador.

Para acompanhar erros, abra **Edge Functions > create-employee > Logs** no painel do Supabase.

## 6. Configurar autenticação

No painel do Supabase:

1. Em **Authentication > URL Configuration**, configure `Site URL` com a URL de produção.
2. Adicione a URL de homologação em `Redirect URLs` se ela for utilizada.
3. Em **Authentication > Providers > Email**, desabilite cadastro público se somente
   administradores criarem funcionários.
4. Configure SMTP próprio em **Authentication > Emails > SMTP Settings**.
5. Revise limites em **Authentication > Rate Limits**.
6. Ative MFA para administradores quando o fluxo estiver implementado.

## 7. Verificar segurança

No painel:

1. Abra **Database > Security Advisor** e resolva alertas.
2. Confirme que RLS está ativa em `colaboradores` e `registros_acesso`.
3. Confirme que `fotos_ponto` é privado.
4. Teste com uma conta comum que ela não acessa dados de outros funcionários.
5. Teste com um administrador que a tela de equipe e os relatórios funcionam.
6. Verifique backups em **Database > Backups**.

## 8. Atualizações futuras

Não edite migrations já aplicadas em produção. Crie uma nova migration:

```bash
npx supabase migration new descricao_da_alteracao
```

Revise o SQL, teste em homologação e só então aplique em produção.
