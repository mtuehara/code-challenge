# Guia de estudo | API de anúncios do Grupo OLX

## A história que vale contar

Imagine alguém cadastrando uma bicicleta. A pessoa envia título, descrição, categoria, imagens e preço. Primeiro a aplicação confere se consegue processar esses dados. Em seguida pede uma decisão à moderação. Com a decisão em mãos, grava o anúncio e devolve um endereço para consultá-lo. A bicicleta aprovada entra no catálogo. Se a descrição tiver um contato proibido, a pessoa ainda recebe um ID e consegue consultar o motivo da reprovação. Se a moderação estiver fora do ar, a pessoa pode tentar novamente.

Esse exemplo explica as três perguntas centrais do projeto. **Quem decide?** O serviço externo decide sobre conteúdo e faixas de preço. **Quando existe um anúncio?** Depois de uma decisão válida e da gravação no PostgreSQL. **Quem aparece na listagem?** Somente anúncios aprovados. A visibilidade dos reprovados era uma ambiguidade do enunciado. A interpretação adotada preserva tanto o catálogo público quanto a explicação para quem cadastrou. [Enunciado](../backend/README.md) · [Decisões](../DECISIONS.md)

## Leia o código seguindo uma requisição

| Ordem | Abra | O que você deve conseguir explicar ao sair |
|---|---|---|
| 1 | [main.ts](../src/main.ts) e [app.ts](../src/app.ts) | O Nest monta controllers e providers. A fábrica do `DataSource` abre a conexão antes de a API começar a servir. No encerramento, a aplicação fecha a conexão. `GET /health` informa que o processo atende HTTP. |
| 2 | [ads.controller.ts](../src/ads/ads.controller.ts) | Localize os três handlers de anúncios. O controller recebe corpo, query ou ID, chama o serviço e cuida de detalhes HTTP como `Location` e `Retry-After`. |
| 3 | [ad.schema.ts](../src/ads/ad.schema.ts) e [zod-validation.pipe.ts](../src/ads/zod-validation.pipe.ts) | TypeScript ajuda durante o desenvolvimento. Zod verifica em execução o JSON que chegou da rede. O pipe transforma problemas em HTTP 400 com o caminho do campo em `details`. Os tipos de entrada são inferidos dos schemas. |
| 4 | [ads.service.ts](../src/ads/ads.service.ts) | Leia `create` na ordem. Ele aguarda a moderação, gera UUID e data, converte o preço, monta o anúncio, salva e mapeia a resposta. O `await` anterior à gravação explica por que uma falha externa deixa a base intacta. |
| 5 | [moderation.client.ts](../src/ads/moderation.client.ts) | O cliente Axios envia quatro campos ao mock, lê a decisão, reconhece os dois nomes de motivo e controla timeout e tentativas. `images` pertence à API de anúncios e fica fora desse payload. |
| 6 | [ads.repository.ts](../src/ads/ads.repository.ts) e [ad.entity.ts](../src/ads/ad.entity.ts) | `create` do repositório monta uma entidade em memória. `save` efetivamente grava. A consulta por ID admite os dois status. A consulta do catálogo inclui o filtro `approved` no próprio SQL gerado pelo TypeORM. |
| 7 | [money.ts](../src/ads/money.ts), [ad.response.ts](../src/ads/ad.response.ts) e [database.ts](../src/database.ts) | Reconstrua o caminho do preço. Identifique o mapper que expõe reais, as migrations que mudaram a coluna e os índices da listagem. |

**Exercício sem olhar o código.** Desenhe duas setas saindo de `AdsService`, uma para a moderação e outra para o repositório. Explique o dado que atravessa cada seta e a ordem em que elas são percorridas. Depois explique por que `GET /ads/{id}` só percorre a segunda.

## Quatro resultados de um mesmo POST

| Entrada ou resposta externa | Resposta pública | O que acontece no banco |
|---|---|---|
| Título curto, preço zero, fração de centavo ou imagens vazias | 400 com detalhes do campo | A validação interrompe a requisição antes da moderação e da gravação. |
| Entrada válida e moderação `approved` | 201, ID, `Location`, motivo nulo | Grava aprovado. Aparece no catálogo e no detalhe. |
| Entrada válida e moderação `rejected` com motivo | 201, ID, `Location`, motivo preenchido | Grava reprovado. O detalhe explica a decisão. |
| Moderação indisponível ou resposta fora do contrato | 503 ou 502 | A criação termina antes de `save`. |

**Por que 201 em uma reprovação?** O cliente pediu a criação de um recurso. A aplicação criou um recurso consultável e a decisão editorial é um dos atributos dele. O teste verifica o `Location` e lê o mesmo anúncio por ID. Usar 422 teria outra semântica para o cliente e exigiria explicar onde consultar a reprovação. [Teste de reprovação](../test/rejection.test.cjs)

**Como separar entrada inválida de um preço reprovado?** O título passa por `trim` e precisa ter entre 10 e 100 caracteres. A descrição e cada item da lista de imagens precisam ter conteúdo. Uma imagem é representada por uma string. A categoria precisa pertencer às seis aceitas. O preço precisa ser um número positivo representável com até dois decimais e dentro da precisão suportada. Já decidir se R$ 21.474.836,48 faz sentido para uma bicicleta é responsabilidade da moderação. A API deve conseguir armazenar essa reprovação. [Schema](../src/ads/ad.schema.ts)

## A história do preço que retornava 500

Siga R$ 800,25: o cliente envia `800.25`, a moderação recebe `800.25`, o banco grava `80025` e o detalhe devolve `800.25`. A conversão de entrada lê a representação decimal, completa a parte fracionária e monta o inteiro. Por exemplo, `0.1` produz 10 centavos. A decisão de recusar `800.255` evita que duas partes discordem sobre um arredondamento.

O primeiro armazenamento era `numeric`. A migration da T-005 converteu registros existentes para centavos inteiros e verificou a precisão legada. Na revisão apareceu um erro de fronteira: R$ 21.474.836,48 equivalem a 2.147.483.648 centavos, exatamente um acima do máximo de um inteiro assinado de 32 bits. O mock reprovava por faixa de preço, mas o PostgreSQL recusava a gravação. Para o cliente isso virava 500.

A correção ampliou a coluna para `bigint` em uma nova migration. O tipo maior resolve o limite do banco. A API ainda trabalha com `number` em JavaScript, por isso valida a precisão inteira segura em centavos antes da chamada externa. O teste que reproduzia 500 agora exige 201, preço preservado e motivo recuperável por GET. Se a entrevista entrar em valores financeiros maiores ou precisão arbitrária, discuta strings decimais no contrato e representação exata ponta a ponta. Isso mudaria clientes e o contrato do mock. [Conversão](../src/ads/money.ts) · [Teste de preço](../test/price.test.cjs)

## Falhas externas e o limite das garantias

Uma requisição externa tem timeout padrão de 3 segundos. Em 429, 5xx, timeout ou erro de rede há uma segunda tentativa. O intervalo padrão é 200 ms. Para 429, um `Retry-After` numérico válido informa o intervalo em segundos, limitado a 1 segundo. Esgotadas as tentativas, a API devolve 503 com `Retry-After: 1`. Duas tentativas lentas podem ocupar a requisição por aproximadamente 6–7 segundos.

Um 400 do mock indica que a própria integração enviou algo que o serviço externo recusou. Uma resposta 200 com decisão desconhecida ou reprovação sem motivo também quebra o contrato. O cliente de moderação sinaliza falha de protocolo e o controller responde 502. Há um detalhe encontrado na prática: o contrato documenta `reason` e o mock usa `rejection_reason`. O código procura texto preenchido nas duas chaves. [Contrato fornecido](../backend/api-mock/docs-candidato/API.md) · [Testes de falhas](../test/moderation.test.cjs)

**E se a aprovação chegou e o banco caiu?** A chamada HTTP externa e o PostgreSQL não compartilham transação. A aprovação, sozinha, não cria o recurso. Há ainda outro cenário: a gravação pode concluir e o cliente perder a resposta. Se repetir o POST, um novo UUID pode produzir outro anúncio. Uma evolução seria aceitar `Idempotency-Key`, associar a chave ao conteúdo e garantir sua unicidade no banco. A repetição interna da moderação e a repetição de toda a criação pelo cliente são problemas diferentes.

## Catálogo, paginação e desempenho

`GET /ads?page=2&pageSize=20&category=esportes` pede até 20 aprovados de esportes após os primeiros 20. O serviço calcula `skip = (page - 1) * pageSize`. O repositório aplica filtro, ordem e limite e obtém o total com `findAndCount`. O serviço calcula `totalPages = Math.ceil(total / pageSize)`. Sem resultados, total e total de páginas são zero. Uma página posterior à última pode ter lista vazia e total positivo.

A ordenação é `createdAt DESC, id DESC`. Dois registros podem compartilhar o mesmo instante. O segundo campo torna o resultado determinístico nesse empate. Há dois índices parciais para aprovados, um para a consulta global e outro para o filtro por categoria. Com poucas linhas, uma varredura sequencial pode ser mais barata. O plano forçado registrado nas decisões demonstrou que o índice pode atender à ordenação. O projeto não mediu vazão ou latência sob carga. [Repositório](../src/ads/ads.repository.ts) · [Teste do desempate](../test/listing.test.cjs)

**Onde começar se crescer?** Meça separadamente o tempo de moderação no POST e o plano SQL da listagem com dados representativos. Para páginas profundas, o banco precisa avançar sobre registros anteriores e contar o conjunto filtrado. Inserções entre duas leituras também podem deslocar itens entre páginas. Um cursor baseado em `(createdAt, id)` permitiria continuar a partir do último item visto. O custo seria mudar o contrato de navegação por número de página e discutir se o cliente ainda precisa de total exato.

## Decisões para defender na entrevista

| Pergunta | Como construir a resposta |
|---|---|
| Por que NestJS e TypeScript para três operações? | A familiaridade do candidato com NestJS pesou na escolha. Controllers, injeção de dependências e pipes deram fronteiras claras. Um servidor HTTP mínimo teria menos configuração. A solução concentrou os três casos de uso em um serviço. |
| Por que PostgreSQL? | Os campos conhecidos, as restrições e as consultas por ID e categoria combinam com um banco relacional. SQLite simplificaria o setup. PostgreSQL trouxe o custo de subir um serviço e permitiu exercitar o mesmo motor nos testes. |
| Por que manter schema, entidade e resposta? | Eles representam contratos diferentes. O schema valida JSON; a entidade representa colunas; o mapper devolve o recurso público. A passagem de `priceCents` para `price` é um exemplo concreto do valor dessa separação. |
| Por que esperar pela moderação? | O cliente já recebe uma decisão final no POST. Uma fila reduziria a espera pela resposta inicial, mas exigiria estado pendente, processamento assíncrono, acompanhamento e outra política de falhas. |
| Por que migrations? | A base pode conter registros criados por versões anteriores. Migrations ordenam alterações e permitem revisar o backfill. O rollback de `bigint` para `integer` só cabe se todos os valores existentes couberem no tipo menor. |
| O que o seed prova? | Ele oferece 57 registros para demonstrar filtros e paginação. A CLI exige tabela vazia e migrations aplicadas. A importação usa uma transação e insere dados de demonstração como aprovados. O fluxo normal de criação por HTTP sempre chama a moderação. |
| Qual diferença entre 400 e 404 no detalhe? | Um ID malformado falha no pipe de UUID com 400. Um UUID válido segue ao banco. Se a linha estiver ausente, o serviço devolve 404. |
| Qual foi uma contribuição da IA que exigiu julgamento humano? | Reconte um exemplo que você reconhece. O Codex sugeriu SQLite e o candidato comparou seus custos com PostgreSQL. Outro exemplo foi trocar a evidência inicial de um 404 na raiz por um healthcheck explícito. Mostre a decisão, a alternativa e o teste. |

Os registros por etapa incluem as escolhas originais, exemplos de prompts e validações. Use-os para reconstruir o que aconteceu com suas próprias palavras. A estimativa registrada foi de 6–8 horas. [DECISIONS.md](../DECISIONS.md) · [AI_USAGE.md](../AI_USAGE.md)

## O que a suíte demonstra

O comando `npm test` compila TypeScript e executa os arquivos com `node:test`. Os cenários HTTP sobem Nest em porta livre, usam PostgreSQL real no banco dedicado `anuncios_test` (5433) e controlam as respostas da moderação com um servidor HTTP de teste. Isso permite programar, por exemplo, um 500 seguido de aprovação e contar as duas chamadas. Os arquivos rodam em série porque compartilham o banco e as migrations. A conversão monetária também tem um teste unitário puro.

| Afirmação que você pode fazer | Evidência para abrir |
|---|---|
| O anúncio sobrevive ao reinício do Nest. | O teste fecha a primeira instância e recupera o mesmo ID por uma segunda instância. [Criação](../test/ads.test.cjs) |
| Uma entrada inválida é rejeitada antes de gerar tráfego externo. | O teste confere detalhes do 400, contador de chamadas e banco. [Validação](../test/validation.test.cjs) |
| Uma falha temporária pode ser recuperada; uma falha persistente impede a gravação. | O teste controla a sequência de respostas e verifica tentativas, status e linhas gravadas. [Moderação](../test/moderation.test.cjs) |
| A listagem distingue aprovados e reprovados e ordena empates. | Fixtures com o mesmo instante e IDs diferentes exercitam a ordem. [Listagem](../test/listing.test.cjs) |
| O seed oferece 57 exemplos e recusa uma segunda execução em tabela ocupada. | O teste chama a função de importação e consulta a API. [Seed](../test/seed.test.cjs) |

Na apresentação, distinga uma prova de comportamento de uma medição de produção. Os testes dão evidência de persistência, contratos e tratamento de falhas. Questões de carga, latência p95 e capacidade por segundo exigiriam um experimento próprio.

## Demo com o Postman

1. Com Node 24 e Docker Compose, execute na raiz `npm ci` e `docker compose up -d --wait postgres`. A demonstração usa o banco de desenvolvimento na porta 5432.
2. Para uma apresentação reproduzível, use um terminal PowerShell exclusivo para o mock. Com a porta 8787 livre, execute `$env:ERROR_RATE = '0'` e depois `node backend/api-mock/server.js`. Essa variável desativa os erros aleatórios do mock nesse processo. Se já houver uma instância com a configuração padrão, você pode usá-la sabendo que um cenário positivo pode receber falha transitória.
3. Em outro terminal, na raiz, execute `npm start`. No Postman Desktop, use **Import** e selecione [anuncios.postman_collection.json](../postman/anuncios.postman_collection.json).
4. Confira as variáveis da collection: `baseUrl` aponta para a API na porta 3000 e `mockUrl` para a moderação na porta 8787. No Runner, execute as pastas na ordem com uma iteração. Para demonstrar manualmente, envie cada criação antes do detalhe correspondente. Os scripts salvam os IDs devolvidos.
5. Observe `Location` no POST aprovado. Abra o detalhe e compare o preço. Em seguida crie o reprovado por preço alto, mostre o motivo no detalhe e abra a listagem filtrada. Termine com um título inválido e mostre o campo indicado em `details`. A pasta do mock permite inspecionar a fronteira HTTP separadamente.

Cada execução completa cria dois registros no banco apontado por `baseUrl`. A API do desafio oferece criação e leitura. Os registros continuam disponíveis para consulta depois da demo. Os cenários determinísticos de 502, 503 e recuperação após retry ficam na suíte de integração.

## Como distribuir uma apresentação de 10 minutos

| Tempo | Mostre | Pergunta que sua explicação responde |
|---|---|---|
| 0–1 min | A bicicleta como exemplo | Qual problema o projeto resolve e o que significa publicar? |
| 1–4 min | POST aprovado, POST reprovado e um GET no Postman | O que o cliente observa? Onde o motivo fica disponível? |
| 4–6 min | `AdsService.create`, cliente de moderação e mapper | Onde cada decisão acontece? Qual fronteira preserva a consistência? |
| 6–8 min | Teste do preço alto e migration | Qual erro real escapou inicialmente e como a correção foi comprovada? |
| 8–10 min | Listagem, custo do OFFSET e uma decisão com IA | O que você mediria ou mudaria primeiro, e qual alternativa considerou? |

**Ensaio de alteração ao vivo.** Suponha que o avaliador peça para reduzir o máximo de `pageSize` de 100 para 50. Combine a aceitação de 50 e a recusa de 51 com 400. Abra o teste de listagem, ajuste os limites e observe a falha esperada. Localize o schema da query, atualize a regra e a mensagem e rode a suíte. Por fim, procure o limite anterior no README e nas especificações. Explique por que o repositório pode continuar recebendo o valor já validado. Esse exercício testa navegação pelo código, leitura de contrato e disciplina para alterar uma regra pequena.
