# Relatorio tecnico — GreenCode AV3

## 1. Biblioteca estatistica

A AV3 usa `simple-statistics` para media, mediana, desvio padrao e regressao linear. A biblioteca cobre as operacoes necessarias sem uma camada de algebra mais ampla. `mathjs` seria maior do que o escopo dos calculos realizados. Na eficiencia, a media e o desvio padrao descrevem o ciclo dos lotes e a mediana reduz a influencia de ciclos atipicos. Na vida util, a regressao de minimos quadrados aproxima a queda da condicao ao longo da idade em meses.

## 2. Modelagem das tabelas

`ApiKey` identifica o parceiro, guarda somente o hash SHA-256, o prefixo de exibicao, permissoes, estado ativo e expiracao. `ReportJob` registra tipo, formato, estado, tentativas, agendamento da proxima tentativa, erro, arquivo e datas do pedido. A relacao opcional com `ApiKey` permite restringir consulta e download ao dono.

Cada execucao cria novas linhas em `EfficiencyReport`, `ProfitabilityReport` ou `LifespanForecast`, sem substituir calculos anteriores. Isso preserva comparacoes por periodo. Eficiencia guarda o operador, mes, media, mediana, desvio, quantidade de lotes e indicador de gargalo. Rentabilidade guarda o grupo por tipo, marca, modelo e estado, valor medio de recuperacao e amostra. Vida util guarda os coeficientes da reta, previsao de meses restantes, tamanho da amostra, indicador de dados suficientes e `actualMonths`, para confronto futuro com a duracao observada.

A AV2 nao possuia marca, modelo, valor recuperado nem data de conclusao de lote. A migration adiciona marca, modelo e valor como opcionais ao equipamento. A rentabilidade usa apenas equipamentos com valor informado. A eficiencia usa a ultima movimentacao conclusiva como data de conclusao. Essa adaptacao reaproveita o historico atual sem afirmar valores que nao existem na base.

## 3. Fila em banco

`ReportJob` tambem funciona como fila persistente. O servidor reivindica um pedido `PENDING` por vez com atualizacao condicional, o que evita dois workers do mesmo processo executarem o mesmo registro. O banco ja necessario a aplicacao evita uma nova infraestrutura e mantem os pedidos apos reinicio. A limitacao e que o banco suporta menos vazao que uma fila dedicada e o worker compartilha recursos com a API.

## 4. Politica de novas tentativas

Cada pedido aceita tres tentativas. A primeira falha agenda espera de 10 segundos, a segunda 60 segundos e a terceira marca `FAILED` com a mensagem de erro. O backoff crescente reduz repeticoes imediatas em falhas temporarias. No inicio, qualquer pedido que tenha ficado em `PROCESSING` volta a `PENDING`, para recuperacao de encerramentos abruptos. Erros e tentativas ficam consultaveis pelo parceiro.

## 5. Seguranca

A chave e gerada com 32 bytes aleatorios e apresentada uma unica vez. O banco guarda SHA-256 e um prefixo curto, nunca o segredo. O hook valida estado e expiracao e aplica permissoes por rota. O rate limit usa o valor de `x-api-key` como identificador para agrupar pedidos por parceiro. As rotas de parceiros e de administracao estao em prefixos separados; as internas usam JWT da AV2 e exigem papel `ADMINISTRADOR`. O download verifica se o job pertence a chave autenticada.

## 6. Versionamento

A API de parceiros usa `/api/v1/public`, enquanto as operacoes administrativas estao em `/api/v1/internal`. Uma mudanca incompativel futura pode ser publicada em `/api/v2/public`, mantendo v1 durante o prazo de transicao. A documentacao `/docs` deve anunciar a data de retirada, orientar a migracao e, enquanto houver suporte, manter os dois prefixos ativos. Nenhuma v2 e criada antes de haver incompatibilidade real.

## 7. Evolucao para centenas ou milhares de parceiros

Para aumentar escala, a evolucao proposta e migrar PostgreSQL e revisar indices/consultas com dados de carga; substituir a fila no banco por BullMQ e Redis com workers separados; mover arquivos para armazenamento externo; adicionar cache para relatorios repetidos; configurar limites por plano; e incluir webhooks assinados para avisar o parceiro quando um job terminar. Essas mudancas permitem escalar API, workers e armazenamento independentemente, com custo operacional adicional.
