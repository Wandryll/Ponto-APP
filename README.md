# Ponto DCT

Aplicação web do Departamento de Ciências e Tecnologia de Manacapuru para controle de ponto, com
autenticação, perfis administrativos, geolocalização, captura de foto e relatórios de jornada.

## Funcionalidades

- autenticação e sessão com Supabase Auth;
- check-in e check-out com sequência validada no banco;
- geolocalização e foto vinculadas ao registro;
- histórico individual e visão administrativa;
- cadastro de funcionários por Edge Function protegida;
- relatórios de presença e horas trabalhadas;
- validação de perfis ativos e controle de acesso por função;
- políticas RLS e buckets com permissões por usuário.

## Tecnologias

- React 19 e TypeScript;
- TanStack Start e TanStack Router;
- Tailwind CSS e Radix UI;
- Supabase Auth, PostgreSQL, Storage e Edge Functions;
- Leaflet e OpenStreetMap;
- Vitest, ESLint e Prettier.

## Arquitetura

O navegador utiliza apenas a chave publicável do Supabase. Autorização e isolamento dos dados
são aplicados por Row Level Security. Operações administrativas que exigem a chave de serviço,
como criar usuários, são executadas exclusivamente por Edge Functions.

```text
Navegador
  ├── TanStack Start
  ├── Supabase Auth
  ├── PostgreSQL + RLS
  ├── Storage + políticas por pasta
  └── Edge Function create-employee
```

## Desenvolvimento local

Requisitos: Node.js 20 ou superior e um projeto Supabase configurado.

```bash
npm ci
cp .env.example .env
npm run dev
```

Variáveis necessárias:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-publicavel
```

Nunca coloque a chave `service_role` em variáveis `VITE_*`.

## Validação

```bash
npm run check
npm audit --omit=dev
```

O pipeline em `.github/workflows/ci.yml` executa formatação, lint, typecheck, testes, build e
auditoria de dependências em pushes para `main` e pull requests.

## Configuração e publicação

- [Configuração do Supabase](SUPABASE.md)
- [Deploy e domínio](docs/DEPLOYMENT.md)
- [Checklist de teste interno](docs/INTERNAL_TEST.md)
- [Política de segurança](SECURITY.md)

## Limitações conhecidas

- faltas exigem uma escala de trabalho configurável, ainda não implementada;
- exportação em PDF e Excel ainda não está disponível;
- ativação, desativação e edição de funcionários ainda não estão disponíveis na interface;
- não há geocerca para limitar registros ao local de trabalho;
- o sistema requer conexão com a internet;
- localização fornecida pelo navegador não elimina fraude em dispositivos comprometidos;
- uso de fotos e geolocalização exige governança e avaliação de LGPD pela organização.

## Status

O projeto está preparado para homologação e piloto interno após a aplicação das migrations,
publicação da Edge Function e execução do checklist operacional. A liberação definitiva deve
ocorrer somente após testes com os navegadores e dispositivos utilizados pela equipe.
