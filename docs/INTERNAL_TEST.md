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
- [ ] Após o login, acessa somente as telas de check-in/check-out e perfil.
- [ ] Tentativas de abrir outras rotas redirecionam para o registro de ponto.
- [ ] Última entrada ou saída do dia permanece visível com o horário e a próxima ação.
- [ ] Histórico abaixo das ações mostra somente os próprios registros.
- [ ] Total trabalhado no dia considera pares concluídos de entrada e saída.
- [ ] Solicitação de câmera e localização compreensível.
- [ ] Check-out bloqueado antes do check-in.
- [ ] Check-in com foto e localização.
- [ ] Check-in permitido dentro da geocerca de 15 metros.
- [ ] Check-in rejeitado pelo banco fora da geocerca.
- [ ] Precisão e distância da localização aparecem corretamente.
- [ ] Localização com mais de dois minutos exige atualização antes do registro.
- [ ] Novo check-in bloqueado até existir check-out.
- [ ] Check-out registrado corretamente.
- [ ] Dashboard em outro dispositivo atualiza os totais globais em até 30 segundos.
- [ ] Atividade recente mostra registros gerais da equipe sem foto do ponto ou coordenadas.
- [ ] Funcionário que fez check-out deixa de aparecer como presente.
- [ ] Histórico mostra somente os próprios registros.
- [ ] Foto privada não abre para outro funcionário.
- [ ] Perfil salva nome, avatar e senha.
- [ ] Conta inativa perde acesso.

## Administrador

- [ ] Visualiza equipe e relatórios.
- [ ] Cria funcionário pela aplicação.
- [ ] Usuário criado consegue entrar.
- [ ] Visualiza registros e fotos da equipe.
- [ ] Prévia do relatório geral apresenta uma linha por funcionário em ordem alfabética.
- [ ] Relatório geral apresenta dias registrados, horas apuradas e pendências por funcionário.
- [ ] Exporta o relatório geral em PDF e em Excel `.xlsx`.
- [ ] PDF geral contém logos, identificação DCT/SEMEC, período, paginação e assinaturas.
- [ ] Excel geral contém a aba "Resumo Geral", filtros nas colunas e totais superiores a 24 horas.
- [ ] Espelho individual exige a seleção de um funcionário.
- [ ] Espelho apresenta todos os intervalos do dia sem inventar horários ausentes.
- [ ] Espelho diferencia ponto em andamento de registro incompleto.
- [ ] Exporta o espelho individual em PDF e em Excel `.xlsx`.
- [ ] Jornada atravessando a meia-noite é atribuída à data da entrada.
- [ ] Nenhum relatório exibe fotos ou coordenadas geográficas.
- [ ] Com os filtros em "Todos", o relatório geral contém toda a equipe ativa.
- [ ] Selecionar outro funcionário apresenta somente a apuração dele.
- [ ] Usuário comum não consegue executar a consulta administrativa do relatório.
- [ ] Exportação sem registros apresenta uma mensagem e não gera arquivo vazio.
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
