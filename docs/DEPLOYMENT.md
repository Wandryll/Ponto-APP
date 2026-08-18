# Deploy e domínio

## Estratégia recomendada

- Vercel para o TanStack Start;
- Supabase para Auth, banco, Storage e Edge Functions;
- domínio registrado em qualquer provedor, incluindo Route 53;
- ambientes separados de homologação e produção.

## 1. Publicar no GitHub

Antes do primeiro push:

```bash
npm run check
npm audit --omit=dev
git status
```

Confirme que `.env`, dumps SQL, fotos e chaves não aparecem no `git status`.

```bash
git init
git add .
git commit -m "feat: initial release"
git branch -M main
git remote add origin URL_DO_REPOSITORIO
git push -u origin main
```

Se o repositório já estiver inicializado, não repita `git init` nem substitua o remote existente.

## 2. Criar o projeto na Vercel

1. Acesse a Vercel e escolha **Add New > Project**.
2. Importe o repositório do GitHub.
3. Confirme o framework **TanStack Start**.
4. Use `npm run build` como Build Command.
5. Configure Node.js 22.
6. Adicione as variáveis:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-publicavel
```

7. Faça o primeiro deploy e teste todas as rotas.

As variáveis `VITE_*` ficam visíveis no navegador. Somente URL e chave publicável podem usar esse
prefixo.

## 3. Configurar domínio

Na Vercel:

1. Abra **Settings > Domains**.
2. Adicione `ponto.suaempresa.com`.
3. Copie os registros DNS apresentados.

No Route 53 ou no registrador do domínio, crie os registros solicitados pela Vercel. Aguarde a
validação do DNS e do certificado HTTPS.

Depois atualize:

- `APP_ORIGIN` nos secrets da Edge Function;
- `Site URL` e `Redirect URLs` no Supabase Auth;
- variáveis de ambiente da Vercel, se a URL do Supabase mudar.

Publique novamente a Edge Function após alterar `APP_ORIGIN`.

## 4. Homologação

O cenário ideal possui dois projetos Supabase:

- `ponto-homologacao`, sem dados reais;
- `ponto-producao`, com acesso restrito.

Branches e previews da Vercel devem apontar para homologação. A branch `main` aponta para produção.
Não permita que previews públicos usem o banco de produção.

## 5. Checklist pós-deploy

```bash
curl -I https://ponto.suaempresa.com
```

Verifique a presença de:

- `Content-Security-Policy`;
- `Strict-Transport-Security`;
- `X-Content-Type-Options`;
- `X-Frame-Options`;
- `Permissions-Policy`;
- `Referrer-Policy`.

Depois execute o roteiro de [teste interno](INTERNAL_TEST.md).

## 6. Rollback

Se um deploy causar falhas:

1. reverta para o deploy anterior na Vercel;
2. não reverta migrations destrutivamente sem backup;
3. desative temporariamente o acesso de usuários afetados, se necessário;
4. registre o incidente e valide os dados antes de liberar novamente.
