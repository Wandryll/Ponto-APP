# Checklist de teste interno

## Preparação

- [ ] Migration aplicada sem erros.
- [ ] Edge Function publicada.
- [ ] Administrador inicial criado.
- [ ] SMTP e URLs de autenticação configurados.
- [ ] HTTPS ativo.
- [ ] Backup confirmado.
- [ ] Security Advisor sem alertas críticos.

## Dispositivos

Teste pelo menos:

- [ ] Android com Chrome.
- [ ] iPhone com Safari.
- [ ] Notebook Windows com Chrome ou Edge.
- [ ] Notebook macOS com Safari ou Chrome, se utilizado pela equipe.

## Funcionário

- [ ] Login correto e rejeição de senha inválida.
- [ ] Solicitação de câmera e localização compreensível.
- [ ] Check-out bloqueado antes do check-in.
- [ ] Check-in com foto e localização.
- [ ] Novo check-in bloqueado até existir check-out.
- [ ] Check-out registrado corretamente.
- [ ] Histórico mostra somente os próprios registros.
- [ ] Foto privada não abre para outro funcionário.
- [ ] Perfil salva nome, avatar e senha.
- [ ] Conta inativa perde acesso.

## Administrador

- [ ] Visualiza equipe e relatórios.
- [ ] Cria funcionário pela aplicação.
- [ ] Usuário criado consegue entrar.
- [ ] Visualiza registros e fotos da equipe.
- [ ] Não recebe privilégios administrativos indevidos em contas comuns.

## Falhas esperadas

- [ ] Câmera negada.
- [ ] Localização negada.
- [ ] Internet interrompida durante upload.
- [ ] Atualização da página durante o registro.
- [ ] Foto maior que o limite.
- [ ] Sessão expirada.

## Critérios para liberar

- nenhum usuário acessa dados de outro sem autorização;
- nenhum registro ou foto fica órfão após falha observada;
- os horários calculados correspondem aos registros;
- o fluxo funciona nos dispositivos reais da equipe;
- responsáveis por suporte, backup e LGPD estão definidos.
