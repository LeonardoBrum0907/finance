# Export Stitch — projeto finance

Instruções oficiais do Stitch MCP para exportar telas.

## Projeto

- **Título:** finance
- **ID:** `26671011250174446`

## Tela exportada

| Campo | Valor |
|---|---|
| Título | Modern Finance Dashboard Minimalist |
| ID | `8aefa736a86c4ce6a4da6e9429f00458` |
| Pasta | `finance/8aefa736a86c4ce6a4da6e9429f00458/` |

## Arquivos

- `screenshot.png` — baixado via `curl -L` da URL em `get_screen`
- `screen.json` — metadados da tela e URLs
- `index.html` — **não disponível** (ver abaixo)

## Fluxo MCP

```text
get_screen(name: projects/26671011250174446/screens/8aefa736a86c4ce6a4da6e9429f00458)
  → screenshot.downloadUrl  → curl -L -o screenshot.png
  → htmlCode.downloadUrl      → curl -L -o index.html
```

## HTML indisponível

O `get_screen` via MCP retornou `htmlCode: {}` (sem `downloadUrl`) para esta tela e para todas as telas do projeto.

Quando o Stitch gerar o HTML, o campo deve aparecer assim:

```json
"htmlCode": {
  "downloadUrl": "https://storage.googleapis.com/...",
  "mimeType": "text/html"
}
```

Então basta rodar:

```bash
curl -L -o design/stitch-export/finance/8aefa736a86c4ce6a4da6e9429f00458/index.html "<htmlCode.downloadUrl>"
```

No Stitch UI, confirme que a tela está em modo **HTML** (não só screenshot) e que a geração terminou com sucesso.
