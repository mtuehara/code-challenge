# Uso de IA na T-001

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
