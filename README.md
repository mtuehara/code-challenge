# API de anúncios | Grupo OLX

API NestJS para criar anúncios, consultar o resultado da moderação e navegar pelo catálogo de aprovados. O Postgres mantém os dados entre reinícios. Consulte também o [enunciado original](docs/ENUNCIADO.md), os [requisitos do backend](backend/README.md), as [decisões](DECISIONS.md) e o [registro de IA](AI_USAGE.md).

## Executar

Na raiz, com Docker e Docker Compose:

```sh
docker compose up -d --build --wait
```

A API responde em http://localhost:3000. O mock usa a porta 8787 e o Postgres a 5432. A migration inicial roda na inicialização. Para parar mantendo os anúncios, use `docker compose down`. As credenciais do Compose servem ao ambiente local.

Para desenvolver com Node 24 instalado, suba apenas as dependências com `docker compose up -d --wait postgres moderation` e execute `npm ci`, `npm run build` e `npm start`. A porta 3000 deve estar livre. As variáveis opcionais são DATABASE_URL, MODERATION_URL, MODERATION_TIMEOUT_MS (padrão 3000) e PORT (padrão 3000).

## Testar

Com Node 24 e Docker, na raiz:

```sh
docker compose up -d --wait postgres-test
npm ci
npm test
```

A suíte recompila a API, usa HTTP local, controla a moderação e limpa apenas a tabela da base dedicada anuncios_test em localhost:5433. Para verificar o mock fornecido com a aplicação completa em execução, rode `node test/smoke.cjs`. Esse comando cria anúncios na base de desenvolvimento e confere o detalhe e o catálogo.

## Consumir

Exemplo no PowerShell:

```powershell
$body = @{ title = 'Bicicleta urbana'; description = 'Quadro azul'; price = 800.25; category = 'esportes'; images = @('https://example.org/bike.jpg') } | ConvertTo-Json
$ad = Invoke-RestMethod http://localhost:3000/ads -Method Post -ContentType application/json -Body $body
Invoke-RestMethod "http://localhost:3000/ads/$($ad.id)"
Invoke-RestMethod 'http://localhost:3000/ads?category=esportes&page=1&pageSize=20'
```

**POST /ads** recebe os cinco campos acima. Título entre 10 e 100 pontos de código Unicode após aparar espaços, descrição preenchida, preço numérico positivo em reais com até duas casas decimais e ao menos uma URL HTTP(S). Categorias aceitas: eletronicos, moveis, veiculos, imoveis, esportes e colecionaveis.

Uma decisão válida retorna 201, cabeçalho Location com /ads/{id}, e JSON como:

```json
{"id":"ba8a090f-0adf-4189-b622-2b718811e90b","title":"Bicicleta urbana","description":"Quadro azul","category":"esportes","price":800.25,"images":["https://example.org/bike.jpg"],"status":"approved","rejectionReason":null,"createdAt":"2026-11-23T15:00:00.000Z"}
```

Para um reprovado, status é rejected e rejectionReason traz o código externo. **GET /ads/{id}** retorna 200 com o mesmo objeto. ID inválido retorna 400 e UUID inexistente retorna 404.

**GET /ads** retorna apenas aprovados. O filtro opcional category precede a paginação. A ordem é createdAt e id decrescentes. page começa em 1 e pageSize em 20 por padrão (máximo 100). Uma categoria sem resultados retorna 200 com:

```json
{"items":[],"page":1,"pageSize":20,"total":0,"totalPages":0}
```

| Situação | Resposta |
| --- | --- |
| Entrada inválida | 400, error.code validation_error. Falhas de schema incluem details por campo |
| Recurso ausente | 404, not_found |
| Resposta externa inválida | 502, moderation_protocol_error |
| Limite de taxa, queda ou 5xx externo | 503, moderation_unavailable. Retry-After em segundos quando disponível |
| Tempo de moderação excedido | 504, moderation_timeout |
| Falha interna inesperada | 500 |

As falhas de moderação interrompem a criação antes da gravação.
O cliente de smoke repete até quatro tentativas por cenário ao receber 503/504. A API faz uma chamada externa por POST.
