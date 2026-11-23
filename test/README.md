# Testes

Este diretório contém a suíte de integração da API. O objetivo é exercitar o comportamento observável pela borda HTTP, com o Nest real, Postgres real e um serviço de moderação controlado.

## Desenho

```text
test/*.test.cjs
   │
   ├─ node:test + assert/strict       runner e asserções nativas do Node
   ├─ test/support/helpers.cjs        setup e limpeza compartilhados
   │
   ├─ createApp()                     mesmo módulo Nest usado por src/main.ts
   │    └─ Postgres anuncios_test     migrations reais, constraints reais
   │
   └─ servidor HTTP controlado        substitui o mock de moderação
```

Não usamos Jest, `supertest` nem `@nestjs/testing`. O runner é o `node:test`, embutido no Node 24, e os testes fazem `fetch` contra uma porta efêmera aberta pela própria aplicação.

### Por que integração, e não só unidade

Os riscos principais do desafio estão na integração:

- persistência real e migrations;
- constraints do Postgres;
- contrato HTTP de entrada e saída;
- chamada ao serviço externo e o que é enviado a ele;
- comportamento após reiniciar a aplicação.

Um teste com `DataSource` mockado não provaria nada disso. Por isso a suíte sobe o Nest de verdade e usa o banco `anuncios_test` na porta 5433. O mock externo é substituído por um servidor HTTP controlado para que o teste seja determinístico (o mock real tem 20% de erro e limite de 5 req/s).

## Arquivos

| Arquivo | Testes | Cobre |
|---|---|---|
| [`ads.test.cjs`](ads.test.cjs) | 1 | Criação aprovada, `Location`, payload enviado à moderação, persistência após reiniciar o Nest e limpeza. |
| [`rejection.test.cjs`](rejection.test.cjs) | 1 | Reprovação com `rejection_reason` e com `reason`, resposta 201, `Location`, `GET` e linha no banco. |
| [`setup.test.cjs`](setup.test.cjs) | 2 | Identidade do banco `anuncios_test` e `GET /health`. |
| [`validation.test.cjs`](validation.test.cjs) | 1 | 15 payloads inválidos, 400 com `details`, zero chamadas à moderação, zero linhas, limites 10/100 e título trimado. |
| [`price.test.cjs`](price.test.cjs) | 1 | Preço em reais na API, `priceCents` inteiro no banco, zero à esquerda, recusa de 3 casas e ausência de `priceCents` na resposta. |
| [`money.test.cjs`](money.test.cjs) | 1 | Conversão pura `toCents`/`fromCents`, sem Nest, banco ou mock. |
| [`listing.test.cjs`](listing.test.cjs) | 1 | Paginação, filtro por categoria, desempate por `id DESC` com `createdAt` empatado, exclusão de reprovados, categoria sem resultados, página além do fim e queries inválidas. |

Total: **8 testes**.

## Helpers

[`support/helpers.cjs`](support/helpers.cjs) concentra o que era repetido:

| Helper | O que faz |
|---|---|
| `connectTestDatabase()` | Abre um `pg.Client` no `anuncios_test` e confere o nome do banco. |
| `startModerationServer(handle)` | Sobe um `http.Server` em porta livre; grava `{method, path, input}` de cada requisição e responde o que o teste mandar. |
| `startTestApi(moderationUrl)` | Define `DATABASE_URL`/`MODERATION_URL`, cria o Nest com `createApp()` e escuta em porta livre. |
| `postAd(baseUrl, input)` | Faz `POST /ads` e devolve `{response, body}` já parseado. |
| `getJson(baseUrl, path)` | Faz `GET` e devolve `{response, body}`. |
| `deleteAds(db, ids)` | Remove somente as linhas criadas pelo teste. |
| `countAds(db)` | Conta linhas para provar que payload inválido não gravou nada. |

O helper é `.cjs` e o `require` precisa da extensão explícita: `require('./support/helpers.cjs')`. O resolver CommonJS do Node não acrescenta `.cjs` sozinho.

## Ciclo de um teste

O padrão é sempre o mesmo:

1. `connectTestDatabase()`.
2. `startModerationServer(...)` com a resposta que o cenário precisa.
3. `startTestApi(moderation.url)`.
4. Executar a requisição com `postAd`/`getJson`.
5. Verificar HTTP, corpo, payload externo e banco.
6. No `finally`: fechar a API, fechar o servidor de moderação, apagar as linhas criadas e fechar o `pg.Client`.

Exemplo reduzido:

```js
const db = await connectTestDatabase();
const moderation = await startModerationServer(() => ({ body: { status: 'approved' } }));
let api;
const createdAdIds = [];

try {
  api = await startTestApi(moderation.url);
  const { response, body } = await postAd(api.url, input);
  if (response.status === 201) createdAdIds.push(body.id);
  assert.equal(response.status, 201);
} finally {
  await api?.close();
  await moderation.close();
  await deleteAds(db, createdAdIds);
  await db.end();
}
```

`api.close()` chama `app.close()`, que dispara o shutdown do Nest e destrói o `DataSource` (`src/app.ts`). O `pg.Client` do teste é separado da conexão do TypeORM e serve para setup, asserções e limpeza.

## Como rodar

Na raiz:

```sh
docker compose up -d --wait postgres-test
npm ci
npm test
```

`npm test` compila o TypeScript para `dist/` e só depois executa os testes. Se rodar `node --test` diretamente depois de alterar `src/`, rode `npm run build` antes; os testes importam `../dist/app`.

Um arquivo específico:

```sh
npm run build
node --test test/validation.test.cjs
```

Os testes usam `--test-concurrency=1` porque compartilham o mesmo banco e rodam migrations na inicialização. Não habilite paralelismo entre arquivos sem separar os bancos.

## O que não usar aqui

- **Jest/`.spec.ts`**: exigiria `jest`, `ts-jest` (ou outro loader), configuração separada e mudança do script; o projeto escolheu `node:test`.
- **`@nestjs/testing`/`TestModule`**: útil para testes de unidade com muitos providers substituídos; aqui `createApp()` já monta o módulo real e o teste HTTP cobre o comportamento. Adicionar o pacote não melhoraria a evidência principal.
- **Mock real de moderação nos testes**: o mock tem erro aleatório e rate limit; use-o apenas em smoke manual. O servidor controlado é o padrão.
- **Banco de desenvolvimento**: a suíte usa exclusivamente `anuncios_test` na 5433; nunca aponte `DATABASE_URL` para `anuncios`.

## Quando adicionar teste de unidade

Vale a pena para lógica pura e barata, sem Nest e sem banco. A T-005 já tem um exemplo real em [`money.test.cjs`](money.test.cjs):

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { toCents } = require('../dist/ads/money');

test('converte reais para centavos sem float', () => {
  assert.equal(toCents(800.25), 80025);
});
```

A regra é: **integração para o comportamento da API; unidade para cálculos e regras isoladas**. Não troque a suíte de integração por mocks só para ganhar velocidade.
