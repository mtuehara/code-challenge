# Uso de IA no desafio

Usei o Codex como par de engenharia para interpretar o enunciado, comparar alternativas e preparar o ambiente NestJS com Postgres. Os prompts abaixo são reformulações de conversas reais. Cada um reúne as perguntas que orientaram uma decisão.

## 1. O que o enunciado deixa em aberto?

**Prompt** — Leia o enunciado e o contrato HTTP do mock. Identifique as regras obrigatórias e as escolhas que preciso fazer. Para cada ambiguidade, proponha um comportamento que eu consiga explicar e testar.

O Codex apontou que o motivo da reprovação precisa ficar visível, mas o enunciado deixa em aberto se o anúncio reprovado aparece na listagem. Pedi que explicasse a consequência para quem cria o anúncio. Escolhi tratar a listagem como catálogo público: o reprovado fica fora dela e pode ser consultado pelo ID com o motivo. Essa decisão ficou para a implementação dos anúncios em uma fatia posterior.

## 2. Qual banco vale o custo de configuração?

**Prompt** — Considerando os campos de um anúncio e as consultas por ID e categoria, compare SQLite, Postgres e um banco de documentos. Que vantagem de cada opção seria útil neste desafio? Quanto ela acrescentaria ao setup?

A sugestão inicial do Codex foi SQLite, pela facilidade de execução. Questionei primeiro o custo de usar Postgres e depois a própria escolha entre SQL e NoSQL. O formato conhecido dos dados e as restrições de integridade favoreceram o modelo relacional. SQLite também atendia a esses critérios. Optei por Postgres aceitando o custo de manter um serviço no Compose e usar o mesmo motor no desenvolvimento e nos testes. As alternativas estão registradas em [DECISIONS.md](DECISIONS.md).

## 3. Como saber que o ambiente está pronto?

**Prompt** — Antes do primeiro POST, como posso verificar que o Nest responde por HTTP e que a suíte está conectada ao banco de testes? Se o container aparece em execução, o que ainda preciso conferir?

Pedi que a preparação do Postgres viesse antes do teste de criação do anúncio. O Codex configurou o Compose com um banco de desenvolvimento e outro de testes. Para verificar o isolamento, a suíte conecta pela porta 5433 e exige que `SELECT current_database()` devolva `anuncios_test`.

Ao tentar abrir o healthcheck, encontrei outra lacuna. O primeiro teste aceitava um 404 na raiz como evidência de que o Nest respondia. Isso deixava sem resposta a pergunta prática de quem inicia o projeto: qual endereço posso abrir para conferir que funcionou? O Codex identificou um container antigo ocupando a porta 3000 e reproduziu o 404 em `GET /health` no Nest da T-001. Depois da correção, `npm test` passou e a chamada local retornou HTTP 200 com `{"status":"ok"}`. O [teste de ambiente](test/setup.test.cjs) mantém as duas verificações, HTTP e SQL.

## Revisão humana

Pedi que cada tarefa chegasse em uma branch própria para eu revisar o diff e decidir o merge. A revisão da T-001 apontou que o setup já existia, mas os documentos de decisões e uso de IA ainda faltavam. O Codex conferiu a árvore do commit `16f6602` e acrescentou os registros no mesmo PR. O fluxo de revisão está descrito em [AGENTS.md](AGENTS.md).
O candidato pediu um start:dev com watcher. O Codex configurou Nodemon e verificou o reinício automático ao atualizar a data de src/app.ts. Após recompilar, GET /health na porta temporária 3011 devolveu {"status":"ok"}.

## T-002 • Primeira fatia de anúncios

Na revisão, perguntei se o enunciado exigia um preço inteiro ou decimal. O Codex conferiu que o enunciado exige um valor positivo e que o mock recebe um número. Escolhi centavos inteiros para armazenamento e cálculos, mantendo o preço em reais nas interfaces HTTP. Atualizamos os exemplos para distinguir o comportamento atual da conversão planejada.

O candidato aprovou o critério antes da implementação. O Codex escreveu um teste pela fronteira HTTP com banco real isolado e moderação controlada. O primeiro npm test falhou com 404 onde esperava 201. Depois de implementar cliente Axios, migration, serviço e controller, os dois testes passaram, incluindo a consulta após reiniciar o Nest.

A chamada externa foi conferida contra o contrato documentado. Na verificação real, um container antigo ocupava a porta 8787. Depois de liberar a porta e recriar a instância do mock, a API retornou 201 com approved e o GET retornou os mesmos dados com 200. A inspeção do mock se limitou ao setup, aos logs e ao contrato HTTP.

A implementação fica em PR próprio para revisão humana. O cenário sugerido é acompanhar a ordem entre aprovação e gravação e verificar por que o GET continua funcionando depois de fechar e reabrir a aplicação.

## T-003 • Validação de entrada

**Prompt** — Implemente a T-003 com teste pela API antes do código. O teste deve falhar porque hoje um anúncio inválido é aceito com 201. Valide título de 10 a 100 caracteres depois do `trim`, descrição não vazia, preço positivo com no máximo 2 casas, categoria entre as seis do mock e ao menos uma imagem. Use o Zod que já está no manifesto, não instale dependência e não altere o mock.

**O que a IA propôs.** Um schema Zod em `src/ads/ad.schema.ts`, um pipe que devolve 400 com `details`, e a retirada do `CreateAdInput` de dentro da entidade. O título passou a ser trimado antes de contar e o valor persistido é o trimado. A categoria virou uma allowlist local; as faixas de preço continuam na moderação.

**O que aceitei.** O schema e o pipe, a validação de categoria antes da rede e a resposta 400 com `details`. O teste cobre 15 payloads inválidos, os limites de 10 e 100 caracteres, a chamada à moderação com o título trimado e a ausência de linhas para payload inválido.

**O que rejeitei ou corrigi.** Não usei `class-validator` nem instalei dependência; não dupliquei as faixas de preço do mock; não arredondei `800.255`; e mantive o `CreateAdInput` fora da entidade, para não acoplar o contrato HTTP à persistência. O primeiro `npm test` falhou com `201 !== 400` no caso de título com 9 caracteres, que era exatamente a falha esperada. Depois da implementação, `npm test` passou nos quatro testes.

**Como validei.** A falha foi observada antes da implementação; o teste verifica status 400, `statusCode`, `error`, `message`, `details`, contador de chamadas da moderação igual a zero e `count(*)` igual a zero. O caso válido confirma 201, título trimado na resposta, título trimado no payload enviado à moderação e título trimado no banco. A saída real está em `specs/anuncios/t003.md`.

## T-004 • Reprovação persistida

**Prompt** — Implemente a T-004 a partir da `t003`, com teste pela API antes do código. O mock pode devolver `200 {"status":"rejected"}`; hoje isso vira 500. O anúncio reprovado deve ser gravado com status e motivo, o POST deve devolver 201 com `Location` e o GET deve devolver o motivo. Crie uma migration nova para o `CHECK`; não edite a migration aplicada e não altere o mock. Leia `rejection_reason` e `reason`, porque o mock real e o `API.md` divergem.

**O que a IA propôs.** Um `ModerationResult` no cliente, a migration `AddRejectedStatus1795536000000`, a união `'approved' | 'rejected'` na entidade e a gravação de `status`/`rejectionReason` no serviço. A escolha de 201 e a leitura das duas chaves foram mantidas.

**O que aceitei.** A migration nova, o resultado tipado, o 201 com `Location`, a leitura de `rejection_reason` com fallback para `reason` e o teste com as duas variantes. A migration inicial ficou intocada.

**O que rejeitei ou corrigi.** Não usei 422, porque o candidato escolheu 201; não li apenas `reason`, que deixaria o motivo nulo no mock real; não editei a migration aplicada; e não tratei falha externa como rejeição. O primeiro `npm test` falhou com `500 !== 201`, que era a falha esperada. Depois da implementação, `npm test` passou nos cinco testes.

**Como validei.** O teste controlado confere 201, `status`, `rejectionReason`, `Location`, `GET` e a linha no banco, inclusive a variante `reason`. Também chamei o mock real com um anúncio contendo “whatsapp”: a API respondeu 201 com `rejectionReason: "contact_info_not_allowed"`, o GET devolveu o mesmo motivo e o banco confirmou `status='rejected'`. A constraint e as duas migrations aplicadas foram conferidas no `pg_constraint`/`advertisement_migrations`. A saída real está em `specs/anuncios/t004.md`.

## Refatoração dos testes • legibilidade

**Prompt** — Refatore os testes para ficarem mais legíveis, sem mudar o comportamento nem afrouxar asserções. Crie um `test/README.md` explicando o desenho, os helpers, como rodar e por que não usamos Jest/`TestModule`/`.spec.ts`. Mantenha `node:test`, o banco real e o mock controlado.

**O que a IA propôs.** Um helper compartilhado em `test/support/helpers.cjs` para banco, servidor de moderação, app Nest, `POST`/`GET`, contagem e limpeza; os quatro arquivos de teste passaram a usar o mesmo ciclo; e o README dos testes documentou o fluxo e as alternativas descartadas.

**O que aceitei.** Os helpers, os nomes explícitos (`startTestApi`, `startModerationServer`, `connectTestDatabase`), os comentários Dado/Quando/Então e o README. As asserções existentes foram mantidas: criação aprovada, reinício, reprovação com as duas chaves, validação com 15 casos, `details`, zero chamadas à moderação, zero linhas e limites de 10/100.

**O que rejeitei ou corrigi.** Não troquei para Jest, `TestModule` ou `.spec.ts`; não criei um mini-framework que escondesse o cenário; e não reduzi o número de asserções. Na primeira execução, os testes falharam com `Cannot find module './support/helpers'` porque o resolver CommonJS não acrescenta `.cjs` sozinho. Corrigi os imports para `./support/helpers.cjs`; depois `npm test` passou nos cinco testes.

**Como validei.** `npm test` passou com `tests 5`, `pass 5`, `fail 0`. O `git diff` foi revisado para confirmar que os cenários e as asserções continuavam iguais; o README dos testes foi conferido contra os arquivos reais. A suíte continua dependendo do Postgres de teste e não usa o mock real.

## T-005 • Preço em centavos

**Prompt** — Implemente a T-005 com teste antes do código: a API continua recebendo e devolvendo reais, mas o banco deve guardar `priceCents integer`. Crie uma migration nova com backfill, sem editar a anterior. A conversão não pode multiplicar `number` por 100; use a representação decimal. O mapper não deve expor `priceCents` na resposta e `800.255` deve continuar retornando 400.

**O que a IA propôs.** `toCents`/`fromCents` em `src/ads/money.ts`, a coluna `priceCents`, a migration `AddPriceCents1795622400000` e o mapper `toAdResponse`. O schema Zod passou a reutilizar `isPriceWithTwoDecimals`, em vez de manter uma segunda regex.

**O que aceitei.** A conversão por string (`"800" + "25"`), o mapper de resposta, a migration com backfill e a checagem que recusa dados legados com mais de 2 casas. O preço enviado à moderação continua em reais.

**O que rejeitei ou corrigi.** Não mantive `numeric` com scale 2; não usei transformer no mesmo campo; não multipliquei `price * 100`; e não expus `priceCents` no JSON. O primeiro `npm test` falhou porque `dist/ads/money` ainda não existia e porque a coluna `priceCents` não existia no banco; eram as falhas esperadas. Depois da implementação, os sete testes passaram.

**Como validei.** `npm test` → `tests 7`, `pass 7`, `fail 0`. O teste de integração consulta o banco e confere `80025` para `800.25`, `10` para `0.1` e 400 para `800.255`; o teste unitário cobre `toCents`/`fromCents` sem banco. Também rodei a migration em um banco temporário com uma linha legada `price=800.25`; o backfill produziu `priceCents=80025`. O banco de teste terminou limpo e as três migrations estavam aplicadas.

## T-006 • Listagem e repositório

**Prompt** — Implemente a T-006 a partir da `main` atualizada: extraia um `AdsRepository` para as operações de banco e deixe o `AdsService` com moderação, mapper e regra de listagem. Crie `GET /ads` com `page`/`pageSize`, filtro por categoria, ordem `createdAt DESC, id DESC`, somente aprovados e índices para a consulta. Teste antes do endpoint; não use `limit`/`offset` nem keyset.

**O que a IA propôs.** O `AdsRepository` (`create`, `save`, `findById`, `findApprovedPage`), o schema de query, o método `list` no serviço, a resposta `{data, page, pageSize, total, totalPages}` e a migration de índices parciais.

**O que aceitei.** O repositório, a paginação 1-based, a ordem com desempate por `id`, a exclusão de reprovados, a validação Zod da query e os dois índices parciais.

**O que rejeitei ou corrigi.** Não incluí reprovados na listagem; não usei `limit`/`offset`; não adicionei keyset/cursor; não coloquei paginação, mapper ou resposta no repositório; e não deixei `where`/`order`/`skip`/`take` no serviço. O filtro `status = 'approved'` faz parte da consulta `findApprovedPage`, porque a listagem pública é o contrato dela. O primeiro `npm test` da listagem falhou com `404 !== 200`; era a falha esperada antes da rota.

**Como validei.** `npm test` → `tests 8`, `pass 8`, `fail 0`. O teste `listing.test.cjs` insere cinco fixtures por SQL (quatro aprovados, sendo dois com o mesmo `createdAt`, e um reprovado), verifica as duas páginas, o filtro por categoria, os padrões, `pageSize=100`, categoria sem resultados, página além do fim, doze queries inválidas e que `GET /ads` não chama a moderação. Também conferi no banco os índices parciais e as quatro migrations; o banco de teste terminou limpo.

**Revisão independente.** Rodei um subagente revisor antes do merge. Ele aprovou sem P1/P2 e apontou P3: o teste não exercitava o desempate por `id DESC`; as fixtures eram inseridas antes das migrations (quebrava o teste isolado em banco novo); faltavam casos de query vazia/limites; e havia frases desatualizadas no README/PR. Corrigi o teste (fixtures depois do app, empate com IDs diferentes, mais casos e `totalPages: 0`), ajustei a documentação e mantive o índice como está, qualificando a alegação de `EXPLAIN`.

## T-007 • Falhas da moderação

**Prompt** — Implemente a T-007 com teste antes do código: duas tentativas para 429/5xx/timeout/erro de rede, respeitando `Retry-After`; depois de esgotar, 503 com `Retry-After` e sem gravar anúncio. 400 ou status desconhecido deve virar 502, sem retry. Reprovação válida continua 201 com motivo. Não use fila nem circuit breaker.

**O que a IA propôs.** `ModerationUnavailableError`/`ModerationProtocolError`, o loop de duas tentativas no `ModerationClient`, o backoff e o teto do `Retry-After`, e a tradução para 503/502 no controller, mantendo a moderação antes do save.

**O que aceitei.** O retry curto, o 503 com header, o 502 para erro de contrato e a possibilidade de ajustar timeout/backoff por env nos testes. O corpo do erro continua no padrão do Nest.

**O que rejeitei ou corrigi.** Não usei retry infinito, circuit breaker, fila assíncrona ou retry para 400/rejected; não coloquei headers HTTP no cliente; e não gravei nada em falha técnica. O primeiro teste falhou por um detalhe meu: os títulos de cenário tinham 9 caracteres e a validação da T-003 os recusava com 400; corrigi os títulos e a falha passou a ser a esperada (`500 !== 201`). Depois da implementação, `npm test` passou nos nove testes.

**Como validei.** `npm test` → `tests 9`, `pass 9`, `fail 0`. O teste controlado cobre 500→200, 429→200, 500 sempre, timeout sempre, 400, status desconhecido e rejected; confere contagem de tentativas, `Retry-After: 1` no 503, 502 sem retry e `count(*) = 0` para falhas. O banco de teste terminou limpo.

## T-009 • Seed de demonstração

**Prompt** — Implemente o seed dos 57 anúncios fornecidos pelo mock, sem alterar `backend/api-mock/**`. O script deve rodar manualmente, recusar base não vazia, gravar preço em centavos, usar `created_at` do seed e imagens placeholder do Picsum (`/seed/{seed}/{width}/{height}`). Não chame a moderação para os 57.

**O que a IA propôs.** `scripts/seed.cjs`, um script `npm run seed`, leitura do `seed/ads.json`, inserção transacional direta como `approved` e placeholders `https://picsum.photos/seed/anuncio-{id}/640/480`.

**O que aceitei.** O script manual, a recusa de base não vazia, o preço em centavos e o placeholder estável. Não alterei o mock nem o seed.

**O que rejeitei ou corrigi.** Não importei no startup; não usei `TRUNCATE`; não passei os 57 pela moderação; e não editei o seed para adicionar imagens. Também conferi que os 57 preços estão dentro das faixas e que o seed tem cinco categorias (não há `colecionaveis`).

**Como validei.** Rodei `npm run seed` no `anuncios_test` vazio: 57 linhas, 0 sem imagem/fora de `approved`; a segunda execução recusou com a mensagem de base não vazia. Depois recriei o schema de teste e a suíte voltou a 9/9. Depois da revisão, adicionei `test/seed.test.cjs`, que sobe a API, executa `seedDatabase`, verifica a listagem de 57 anúncios e a contagem de `veiculos`, confirma a recusa da segunda execução e limpa o banco; a suíte passou a 10/10. O banco de desenvolvimento não foi tocado.
