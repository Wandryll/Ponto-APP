# Notas de engenharia

Este documento registra falhas encontradas durante a homologação e práticas que devem ser
reutilizadas em projetos futuros.

## Câmera, foto e upload em navegadores móveis

### Falha observada

O registro de ponto exibia apenas `Failed to fetch` depois da captura da foto, sem uma requisição
correspondente nos logs do Supabase.

### Causa

A selfie era representada por uma URL `data:` e convertida em arquivo por meio de `fetch(dataUrl)`.
Embora essa operação funcione em muitos navegadores desktop, ela pode falhar com imagens grandes
ou em navegadores móveis. A falha ocorria antes do upload e, por isso, não aparecia no Supabase.

### Correção aplicada

- Converter a URL `data:` diretamente para `Blob` no navegador, sem uma requisição `fetch`.
- Validar formato e tamanho antes do upload.
- Separar mensagens de erro para conversão, Storage e inserção no banco.
- Encerrar as trilhas da câmera ao capturar a foto ou sair da página.

### Prevenção

- Testar câmera e geolocalização em Android, iOS e notebook antes do lançamento.
- Incluir cenários com permissão negada, sessão expirada e conexão interrompida.
- Dividir operações externas em etapas identificáveis e apresentar mensagens específicas.
- Usar monitoramento de erros sem registrar fotos, senhas, tokens ou coordenadas exatas.
- Considerar o build e os testes automatizados como necessários, mas não substitutos da
  homologação em dispositivos reais.

## Deploys de atualização de dependências

O Dependabot cria branches e pull requests isolados. Uma falha no Preview Deployment dessas
branches não altera o deploy de produção enquanto a atualização não for mesclada em `main`.

Antes de aceitar uma atualização automática:

1. Conferir o erro completo do CI e da Vercel.
2. Confirmar que `package.json` e `package-lock.json` estão sincronizados.
3. Executar `npm ci` e `npm run check` na branch da atualização.
4. Mesclar somente depois que CI e Preview Deployment forem aprovados.
