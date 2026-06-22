# Orçamentos Mensais — referência de design

Tela de orçamentos mensais alinhada ao protótipo Stitch / AI Studio (`BudgetsTab.tsx`).

## Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `YtYjk.png` | Screenshot exportado do frame Pencil **Orçamentos Mensais** |
| `orcamentos-mensais.pen` | Arquivo Pencil do projeto (editável no Cursor via Pencil MCP) |

## Estrutura da tela

1. **Cabeçalho** — título, subtítulo e filtro por pessoa (opcional)
2. **Card agregado** — consumo mensal global, barra de progresso, totais e economia potencial
3. **Grid 3 colunas** — 12 cards (grupos de `DASHBOARD_CATEGORY_GROUPS`) com saturação, gasto/limite e status

## Implementação React

- Página: [`apps/web/src/pages/BudgetsPage.tsx`](../../apps/web/src/pages/BudgetsPage.tsx)
- Componentes: [`apps/web/src/components/budgets/`](../../apps/web/src/components/budgets/)

## Status visual por saturação

- Verde (`safe`): até 75%
- Âmbar (`warning`): 75%–90%
- Vermelho (`critical`): acima de 90%
