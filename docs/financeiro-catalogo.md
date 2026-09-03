# Catálogo de controle financeiro (PF / família)

Mapa de **funcionalidades, métricas e informações** comuns em sistemas de finanças pessoais/familiares, cruzado com o que este app já cobre. Serve como backlog futuro — **não é uma spec de implementação**.

| | |
|---|---|
| Recorte | Pessoa física / casal / família, visão **internacional** |
| Fora de escopo | PJ / DRE / contabilidade; pacote fiscal Brasil ou US como core |
| Referências de mercado | YNAB, Mint / Credit Karma, Monarch Money, Copilot Money, Empower / Personal Capital, PocketGuard, Emma, Money Dashboard; padrões 50/30/20, envelope, FIRE |

Prioridade sugerida (hipótese; confirmar antes de implementar):

| Código | Significado |
|---|---|
| P1 | Visão — patrimônio, caixa e o “onde estou” |
| P2 | Operação diária — lançar, pagar, orçar, alertar |
| P3 | Planejamento — dívidas, metas longas, investimentos |
| P4 | Nice-to-have |

Status vs este repositório: **feito** · **parcial** · **ausente**.

```mermaid
flowchart LR
  ingest[Ingestao bancos e manual]
  ledger[Razao transacoes contas]
  metrics[Metricas patrimonio fluxo orcamento]
  plan[Metas dividas investimentos]
  surface[Dashboard alertas relatorios IA]
  ingest --> ledger --> metrics --> plan --> surface
```

---

## Baseline do produto

| Domínio | Já existe |
|---|---|
| Auth | Login/registro, sessão cookie |
| Família | Várias `Person` por usuário, filtro por pessoa |
| Bancos | Pluggy Open Finance, sync 365 dias, webhook, status da conexão |
| Contas | Corrente + cartão (limite, disponível, faturas) |
| Transações | Categoria Pluggy + usuário, merchant |
| Dashboard | Saldo, patrimônio (banco / dívida cartão / investimentos), ciclo payday, renda/despesa, categorias, série mensal |
| Orçamento | Grupos por categoria + limite |
| Metas | Valor-alvo, tracking manual/conta, contribuições |
| Investimentos | Posição Pluggy (tipo, taxa, P&L) |
| Recorrentes / parcelas | `RecurringBill`, `PaymentCommitment`, `ManagedAccount` |
| Simulação | Cenários + impacto |
| IA | Chat com contexto + propostas de ação |
| Settings | Payday, tema, incluir investimentos no patrimônio |

---

## A. Patrimônio e balanço (net worth)

Núcleo de apps tipo Empower / Monarch. Patrimônio líquido = ativos − passivos.

| Capacidade | Informações / métricas | Status | Prioridade |
|---|---|---|---|
| Patrimônio líquido consolidado | `netWorth.total`; split banco / dívida de cartão / investimentos | parcial | P1 |
| Saldos de contas bancárias | Caixa por conta e por pessoa | feito | — |
| Dívida de cartão no patrimônio | Saldo, limite, disponível | feito | — |
| Investimentos no patrimônio | Flag `includeInvestmentsInNetWorth` | feito | — |
| Ativos manuais | Imóvel, veículo, bens, cripto, previdência, espécie | ausente | P1 |
| Passivos além do cartão | Financiamento, empréstimo, consórcio, cheque especial | ausente | P1 |
| Histórico de patrimônio | Curva 12–60 meses, Δ MoM / YoY | ausente | P1 |
| Alocação de ativos | % renda fixa / variável / imóveis / caixa | ausente | P3 |
| Liquidez vs travado | Caixa imediato vs ativos ilíquidos | ausente | P3 |
| Benchmark de patrimônio | Vs inflação / CDI / S&P | ausente | P4 |
| DTI (dívida / renda) | Debt-to-income | ausente | P3 |

---

## B. Fluxo de caixa (cash flow)

| Capacidade | Informações / métricas | Status | Prioridade |
|---|---|---|---|
| Renda / despesa / net do período | Calendário ou ciclo payday; exclui transferências internas | feito | — |
| Extrato unificado pesquisável | Filtros: pessoa, conta, categoria, merchant, valor, tags | ausente | P1 |
| Lançamentos manuais | Cash, PIX avulso, conta sem Open Finance | ausente | P1 |
| Transferências marcadas | Par origem/destino (não só heurística de nome) | ausente | P2 |
| Regras de categorização | “Sempre que X → categoria Y / pessoa Z” | ausente | P2 |
| Split de transação | Um gasto, várias categorias | ausente | P2 |
| Reconciliação | Conferido vs extrato do banco | ausente | P3 |
| Savings rate | Poupança / renda do período | ausente | P1 |
| Burn rate | Despesa média por mês | ausente | P2 |
| Cash runway | Meses de caixa no ritmo atual | ausente | P2 |
| Cash vs crédito no mês | Quanto saiu de conta vs cartão | ausente | P2 |

---

## C. Orçamento (budgeting)

Padrões de mercado: envelope/YNAB, 50/30/20, zero-based, limites por categoria (o que o app faz hoje).

| Capacidade | Informações / métricas | Status | Prioridade |
|---|---|---|---|
| Limite por grupo de categorias | `BudgetGroup` + `% usado` implícito no gasto | parcial | P2 |
| Período alinhado ao dashboard | Mês calendário **ou** ciclo payday | ausente | P2 |
| Rollover | Sobra vai para o próximo período | ausente | P2 |
| Envelope / “give every dollar a job” | Dinheiro atribuído vs não atribuído | ausente | P3 |
| Alertas 80% / 100% | Notificação de estouro | ausente | P2 |
| Orçamento por pessoa | Hoje o grupo é do `User`, não da `Person` | ausente | P2 |
| Templates 50/30/20 | Needs / wants / savings | ausente | P3 |
| Remaining / overspent | Valor restante e estouro | ausente | P2 |
| Forecast de estouro | Projeção no ritmo atual | ausente | P3 |

---

## D. Dívidas e crédito

| Capacidade | Informações / métricas | Status | Prioridade |
|---|---|---|---|
| Cartão: saldo, fatura, limite | Pluggy + dashboard | feito | — |
| Parcelas / compromissos | `PaymentCommitment` | feito | — |
| Faturas fechadas/abertas | Via Pluggy no dashboard | parcial | P2 |
| Utilização do limite | `balance / creditLimit` | ausente | P2 |
| Melhor dia de compra | Ciclo de fechamento / vencimento | ausente | P3 |
| Juros rotativo / anuidade | Custo do cartão | ausente | P3 |
| Score de crédito | Onde existir API | ausente | P4 |
| Snowball vs avalanche | Plano de quitação | ausente | P3 |
| CET / taxa efetiva | Juros pagos no ano (YTD) | ausente | P3 |
| Dívidas manuais | Financiamento imóvel/carro | ausente | P1 |
| Min payment vs full | Escolha de pagamento | ausente | P3 |
| Months to payoff | Meses para zerar no ritmo atual | ausente | P3 |

---

## E. Recorrentes, assinaturas, contas a pagar

| Capacidade | Informações / métricas | Status | Prioridade |
|---|---|---|---|
| Detecção de contas recorrentes | `RecurringBill` + ocorrências por ciclo | feito | — |
| Contas gerenciadas | `ManagedAccount` | feito | — |
| Inbox “a pagar esta semana” | Bills calendar 7/14/30d | ausente | P2 |
| Assinaturas (SaaS/streaming) | Lista + sugestão de cancelamento | ausente | P3 |
| Notificação de vencimento | E-mail / push | ausente | P2 |
| Pago / atrasado na home | Status visível | ausente | P2 |
| Recorrente / renda | % da renda comprometida | ausente | P2 |
| Late count | Quantidade em atraso | ausente | P2 |

---

## F. Metas e planejamento

| Capacidade | Informações / métricas | Status | Prioridade |
|---|---|---|---|
| Meta com alvo, data, contribuições | Tracking manual ou conta | feito | — |
| Planos agregando metas | `Plan` / `PlanGoal` | feito | — |
| Simulação de impacto | Cenários | feito | — |
| Reserva de emergência | **Meses de despesa cobertos** (caixa / despesa média) | ausente | P1 |
| FIRE | FI number, savings rate, years to FI, SWR 4% | ausente | P3 |
| Projeção de chegada | “Neste ritmo chega em DATA” | ausente | P3 |
| Sinking funds | Férias, IPVA, seguro — envelope anual | ausente | P3 |
| % concluído / gap | Distância do alvo | parcial | P2 |
| Contribuição mensal necessária | Valor para bater a data | ausente | P2 |
| On-track / off-track | Semáforo vs data-alvo | ausente | P2 |

---

## G. Investimentos e aposentadoria

| Capacidade | Informações / métricas | Status | Prioridade |
|---|---|---|---|
| Posições via Open Finance | Tipo, taxa, P&L Pluggy | feito | — |
| Incluir/excluir do patrimônio | Setting do usuário | feito | — |
| Custo médio / aportes / dividendos | Tax lots (visão intl) | ausente | P3 |
| Performance vs benchmark | TWR / MWR, yield | ausente | P3 |
| Rebalanceamento sugerido | Target vs atual | ausente | P4 |
| Previdência como conta | 401k / IRA / PGBL–VGBL | ausente | P3 |
| Asset allocation target | % alvo vs posição | ausente | P3 |
| Unrealized P&L | Já parcialmente na posição Pluggy | parcial | P3 |
| Concentration / fees | Risco de concentração, taxas | ausente | P4 |

---

## H. Relatórios e insights

| Capacidade | Informações / métricas | Status | Prioridade |
|---|---|---|---|
| Categorias no dashboard | Gastos por categoria | feito | — |
| Série mensal | `monthlySeries` | feito | — |
| Growth metrics / insights | `growthMetrics` | parcial | P2 |
| Arena entre pessoas | Comparação household | feito | — |
| Relatório mensal/anual exportável | PDF / CSV | ausente | P2 |
| Merchant ranking | “Você gastou X no iFood” | ausente | P2 |
| Comparáveis | Mês vs média 3m / mesmo mês ano anterior | ausente | P2 |
| Heatmap / sazonalidade | Padrão de gasto no tempo | ausente | P4 |
| DRE pessoal | Income statement + net worth statement | ausente | P3 |
| Top N / MoM / YoY / outliers | Rankings e anomalias | ausente | P2 |

---

## I. Família / multi-pessoa

| Capacidade | Informações / métricas | Status | Prioridade |
|---|---|---|---|
| Várias pessoas + filtro | Dashboard por `personId` | feito | — |
| Payday por pessoa | Ciclo e âncora | feito | — |
| Saldos por pessoa | `perPerson` / cycle summary | feito | — |
| Contas conjuntas vs individuais | Ownership % | ausente | P3 |
| Divisão de despesas | Split 50/50 ou proporcional à renda | ausente | P3 |
| IOU interno | “Quem deve a quem” | ausente | P4 |
| Permissões | Cônjuge vê tudo / só agregado | ausente | P4 |
| Orçamento e metas por pessoa e do casal | Escopo Person vs User | ausente | P2 |
| Contribuição % / gap de gasto | Fairness entre pessoas | ausente | P3 |

---

## J. Cadastro, categorias, dados mestres

| Capacidade | Informações / métricas | Status | Prioridade |
|---|---|---|---|
| Categorias Pluggy + mapping + IA | `CategoryMapping`, `userCategory` | parcial | P2 |
| Taxonomia editável | Árvore categoria → subcategoria | ausente | P2 |
| Tags, notes, anexos | Nota fiscal / comprovante | ausente | P4 |
| Multi-moeda + câmbio | FX, saldos em várias currencies | ausente | P2 |
| Contas manuais | Carteira, banco sem Open Finance | ausente | P1 |
| Ocultar conta do patrimônio | Exclude flag | ausente | P2 |

---

## K. Alertas, higiene e automação

Hoje quase só sync + chat.

| Capacidade | Informações / métricas | Status | Prioridade |
|---|---|---|---|
| Alerta de saldo baixo | Threshold configurável | ausente | P2 |
| Alerta de fatura fechando | Dias até vencimento | ausente | P2 |
| Alerta de orçamento estourado | 80% / 100% | ausente | P2 |
| Alerta de transação grande | Threshold | ausente | P2 |
| Conexão Pluggy quebrada | Status / reautorizar | parcial | P2 |
| Digest semanal | Resumo por e-mail | ausente | P3 |
| Duplicata / fraude | Detecção de lançamento repetido | ausente | P3 |
| Consentimento Open Finance expirando | Health score da conexão | ausente | P2 |

---

## L. IA (além do chat atual)

| Capacidade | Informações / métricas | Status | Prioridade |
|---|---|---|---|
| Chat com contexto financeiro | Threads + propostas de ação | feito | — |
| Quota de tokens | `aiTokensUsedThisMonth` | feito | — |
| Recap semanal em linguagem natural | “Por que o saldo caiu?” | ausente | P3 |
| Classificação assistida | Sugerir categoria no extrato | parcial | P2 |
| Forecast em linguagem natural | Projeção conversacional | ausente | P3 |
| Coaching de orçamento | Sugestões de corte | ausente | P3 |

---

## M. Conformidade, privacidade, multi-país

Pacotes fiscais são **opcionais por país** — não misturar no core.

| Capacidade | Informações / métricas | Status | Prioridade |
|---|---|---|---|
| Multi-currency e FX | Ver também J | ausente | P2 |
| Locale de data / número | i18n | ausente | P2 |
| Export GDPR / exclusão | Download e delete da conta | ausente | P3 |
| 2FA / sessões / audit log | Segurança de acesso | ausente | P3 |
| IRPF / informe (Brasil) | Pacote opcional | ausente | P4 |
| 1099 / tax lots (US) | Pacote opcional | ausente | P4 |

---

## Métricas universais (shortlist)

As que quase todo sistema PF sério calcula.

| # | Métrica | Status no app | Prioridade se ausente/parcial |
|---|---|---|---|
| 1 | Patrimônio líquido | parcial (sem série histórica) | P1 |
| 2 | Saldo em conta / caixa | feito | — |
| 3 | Dívida de cartão / crédito | feito | — |
| 4 | Renda vs despesa vs net do período | feito | — |
| 5 | Savings rate | ausente | P1 |
| 6 | Meses de emergência (caixa / despesa média) | ausente | P1 |
| 7 | Debt-to-income | ausente | P3 |
| 8 | Utilização de limite do cartão | ausente | P2 |
| 9 | Recorrentes / renda | ausente | P2 |
| 10 | % orçamento consumido | parcial | P2 |
| 11 | Contribuição mensal necessária para metas | ausente | P2 |
| 12 | Alocação de investimentos | ausente | P3 |
| 13 | Cash runway | ausente | P2 |
| 14 | MoM / YoY de patrimônio e gastos | ausente | P1 |

---

## Hipótese de priorização

Confirmar antes de puxar para o roadmap de código.

- **P1 (visão):** histórico de patrimônio, contas/passivos manuais, extrato unificado + lançamento manual, meses de emergência, savings rate, MoM/YoY
- **P2 (dia a dia):** calendário a pagar, alertas, regras de categoria, orçamento no ciclo payday + rollover, multi-moeda, merchant ranking, utilização do cartão
- **P3 (plano):** snowball/avalanche, sinking funds, FIRE/projeção, performance vs benchmark, DTI, DRE pessoal
- **P4:** score de crédito, split IOU, tax packs por país, anexos, heatmap, rebalanceamento
