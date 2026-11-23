# Uso de IA na T-001

Usei o Codex como par de engenharia para discutir a especificação, preparar o ambiente e verificar se ele funcionava. Os blocos abaixo reproduzem trechos da conversa. Os parágrafos ao redor explicam o contexto e o que mudou no projeto.

## Especificar antes de implementar

> Trabalhe comigo como par de engenharia no desafio backend do Grupo OLX. Eu serei responsável pela entrega e preciso conseguir explicar e alterar qualquer parte dela ao vivo.

No pedido inicial, indiquei a ordem de leitura dos três documentos do desafio e pedi uma primeira resposta só na conversa. Queria revisar o comportamento da API antes de escolher como implementá-lo. Um dos pedidos foi:

> Uma tabela com “comportamento”, “origem” e “exemplo verificável”. Em “origem”, diferencie requisito explícito de decisão proposta.

Essa distinção trouxe uma decisão concreta para a discussão. O enunciado exige que o motivo da reprovação fique visível, mas deixa em aberto se o reprovado aparece na listagem. O Codex propôs tratar a lista como catálogo público. Pedi a justificativa e concordei em manter o reprovado consultável pelo ID. Essa decisão orienta uma fatia posterior à T-001.

## Questionar a escolha do banco

> pq sqlite ao inves de postgres?

> mas entre sql e nosql qual e por que?

Foram duas perguntas em sequência. O Codex havia sugerido SQLite para economizar setup dentro das 4–6 horas. A primeira pergunta levou à comparação entre um arquivo local e um serviço Postgres no Compose. A segunda abriu uma questão anterior à escolha do produto: que característica dos anúncios justificava um banco relacional?

Discutimos o formato conhecido dos dados, as restrições de integridade e as consultas por ID e categoria. Um banco de documentos também atenderia, especialmente se cada categoria tivesse atributos muito diferentes. Aprovamos Postgres e aceitamos o custo de subir um serviço adicional. Os trade-offs estão em [DECISIONS.md](DECISIONS.md).

## Definir o que conta como ambiente funcionando

> acha que montar o container do postgres nao seria um pre requisito tbm?

Depois de subir o container, mostrei a tela do Docker Desktop e perguntei:

> essa nao seria a prova que esta rodando?

A tela confirmava que o container estava em execução. Para começar o TDD, também precisávamos saber se a suíte conseguia consultar a base correta. Ao rever o escopo da T-001, combinamos verificar HTTP e SQL antes de implementar o primeiro anúncio. Assim, um problema de conexão pode ser identificado antes de interpretar a falha de um teste de negócio.

O Codex preparou o módulo inicial do NestJS, o Compose, as instruções e o [teste de ambiente](test/setup.test.cjs). Executou `docker compose up -d --wait postgres postgres-test`, que indicou os dois serviços saudáveis, e `npm test`, que compilou o TypeScript e passou um teste. O teste observou HTTP 404 na raiz do Nest e exigiu que `SELECT current_database()` retornasse `anuncios_test` pela porta 5433. A criação de um anúncio pela API fica para a T-002.

## Corrigir o fluxo de revisão

> precisamos sempre passar por revisao humana no final, é o human in the loop?

Pedi que cada tarefa passasse por revisão humana antes do merge. Na T-001, o Codex preparou a branch, o diff e as evidências de execução. Cabe a mim conferir se consigo reproduzir o resultado e explicar a mudança antes de integrá-la. Registramos essa divisão em [AGENTS.md](AGENTS.md).

A revisão encontrou uma omissão concreta no commit `16f6602`: a escolha da stack estava no código, mas faltavam `DECISIONS.md` e `AI_USAGE.md`. O Codex conferiu a árvore do commit e acrescentou os dois registros na mesma branch para nova leitura.
Ao tentar iniciar o Nest para consultar o healthcheck, o candidato identificou uma lacuna no setup. O Codex confirmou a porta 3000 ocupada pela API anterior e reproduziu o 404 em GET /health no Nest da T-001. Após adicionar a rota, npm test passou e a consulta local respondeu 200 com {"status":"ok"}.
