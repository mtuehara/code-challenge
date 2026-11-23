# Decisões de engenharia

As seções por etapa registram as decisões e os resultados obtidos em cada PR. O [README](README.md) descreve o contrato em uso.

## T-001 • Ambiente de desenvolvimento e testes

| Escolha | Alternativa considerada e consequência |
| --- | --- |
| TypeScript e NestJS | Um servidor HTTP mínimo em Node reduziria o setup. A experiência do candidato com NestJS pesou mais, pois ele vai explicar e alterar a aplicação ao vivo. Nesta etapa, o módulo apenas inicializa o servidor. |
| PostgreSQL 16 | SQLite simplificaria a execução local. Um banco documental acomodaria atributos diferentes por categoria. Para os campos conhecidos do anúncio, escolhemos um banco relacional com restrições de integridade e suporte às consultas paginadas previstas. O custo imediato é manter um serviço de banco em execução. |
| Docker Compose para os bancos, NestJS local | Rodar toda a aplicação em containers também foi considerado. Durante o desenvolvimento, iniciar o Nest localmente facilita depurar. O Compose mantém duas instâncias: desenvolvimento em 5432 com volume persistente, testes em 5433 com armazenamento temporário. Isso permite exercitar o mesmo motor de banco sem misturar dados. |
| Teste com o runner do Node, HTTP e cliente pg | Jest e Supertest foram considerados. O runner e o fetch do Node já atendem ao teste de prontidão. A conexão SQL direta permite conferir o nome da base antes de implementar a persistência dos anúncios. |

TypeORM e Zod entraram no manifesto na T-001. A T-002 adotou TypeORM para persistência. Para a validação de entrada, a experiência anterior do candidato com Zod e a inferência de tipos pesaram na escolha diante dos DTOs com class-validator.

**Limite da evidência.** O [teste de ambiente](test/setup.test.cjs) verifica que `GET /health` retorna 200 e que a conexão SQL identifica `anuncios_test`. A primeira versão usava o 404 na raiz como sinal de disponibilidade. A T-002 acrescentou um teste que recupera o anúncio após reiniciar o Nest.
Para desenvolvimento, npm run start:dev usa Nodemon observando src e tsconfig.json. Cada alteração executa npm start, incluindo a compilação TypeScript com os metadados de decorators do Nest.

## T-002 • Aprovação e persistência

- O candidato aprovou o critério de criar, moderar, persistir e consultar após reiniciar o Nest. O controller cuida de HTTP e Location. O serviço coordena a moderação e a gravação. Usamos diretamente o repository do TypeORM.
- Axios foi solicitado pelo candidato para centralizar baseURL e timeout no cliente da moderação. A alternativa discutida foi fetch. O cliente envia somente os quatro campos previstos no contrato externo e exige HTTP 200 com status approved.
- A migration cria advertisements e roda durante a inicialização. synchronize fica desabilitado. Os testes rodam sequencialmente para evitar duas inicializações concorrentes aplicando a migration na mesma base. Múltiplas réplicas exigiriam executar migrations em uma etapa separada.
- Para esta fatia, escolhemos numeric no Postgres e mantemos price em reais na API. A alternativa discutida anteriormente foi centavos inteiros. Numeric preserva o decimal armazenado, enquanto a interface JSON segue a precisão de number do JavaScript. A T-003 definiu a precisão aceita na entrada.
- Na revisão da T-002, o candidato escolheu centavos inteiros para armazenamento e cálculos. O enunciado exige preço positivo, e o contrato do mock especifica apenas `number`. O campo `price` continua em reais na API e no mock. A T-005 implementou a conversão pela representação decimal e o armazenamento em centavos.
- O POST aguarda a aprovação antes de inserir. A conexão com o banco é encerrada junto com a aplicação. O teste fecha e reabre o Nest para conferir que o GET depende da persistência.
- A restrição de status na migration admite approved nesta fatia. A migration da T-004 acrescentou `rejected` para gravar a reprovação com motivo.

## T-003 • Validação de entrada

- O candidato aprovou validar a entrada antes da moderação e contar o título depois do `trim`. O schema Zod fica em `src/ads/ad.schema.ts` e o pipe em `src/ads/zod-validation.pipe.ts`; o `CreateAdInput` passou a ser inferido do schema e saiu da entidade. Alternativa descartada: `class-validator` com DTOs, que exigiria dependências novas e mais decorators para o mesmo resultado.
- O título é trimado antes de contar e o valor trimado é o persistido. Um título de 9 caracteres visíveis, mesmo com espaços nas pontas, é recusado; um de 10 a 100 é aceito. Alternativa descartada: contar o valor bruto, que rejeitaria espaços benignos.
- O preço é aceito apenas como número JSON finito, maior que zero e com no máximo 2 casas decimais. Na T-003, o banco ainda usava `numeric` e a API já recusava `800.255`. A T-005 introduziu a conversão para centavos. Alternativa descartada: arredondar silenciosamente.
- A categoria é validada localmente contra as seis categorias do mock para devolver 400 antes da chamada externa. As faixas de preço continuam na moderação, conforme `AGENTS.md`. Alternativa descartada: deixar a categoria para a moderação e traduzir o 400 externo, o que gastaria uma chamada de rede para um erro previsível.
- Erro de validação: 400 com `{statusCode, error, message, details}`; a moderação não é chamada e nenhuma linha é gravada. Campos desconhecidos são ignorados. Alternativa descartada: corpo default do Nest, que mistura formatos entre validação, 404 e 503.
- **Limite da evidência.** O teste `test/validation.test.cjs` usa um servidor de moderação controlado e o Postgres de teste; não usa o mock real. A T-004 cobre reprovação e a T-005 cobre centavos. O primeiro `npm test` falhou com 201 onde o teste esperava 400; depois da implementação, os quatro testes passaram.

## T-004 • Reprovação persistida

- O candidato escolheu `201` para anúncio reprovado, com `status: "rejected"` e `Location`, em vez de `422`. O recurso é criado e persiste; o status e o motivo ficam no corpo. Alternativa descartada: `422`, que sinaliza rejeição mas ou não persiste ou devolve um código que normalmente significa “não processei”.
- O cliente passou a devolver um resultado (`approved` ou `rejected` com motivo), em vez de lançar erro para qualquer status diferente de `approved`. O serviço grava `status` e `rejectionReason` na mesma operação; o controller não mudou e o 201 continua sendo o padrão do `POST`.
- O mock real devolve `rejection_reason`; o `API.md` documenta `reason`. O cliente lê `rejection_reason` primeiro e `reason` como fallback, e a API expõe `rejectionReason`. Alternativa descartada: ler apenas `reason`, que deixaria o motivo nulo no mock real.
- Migration nova `AddRejectedStatus1795536000000` troca o `CHECK (status = 'approved')` por `CHECK (status IN ('approved', 'rejected'))`. A migration inicial não foi editada. O `down` restaura a restrição antiga e só é seguro se não houver reprovados; isso está documentado no código.
- O tipo `status` da entidade passou a ser `'approved' | 'rejected'`; `rejectionReason` continua nullable. A listagem e a exclusão de reprovados ficaram para a T-006; falhas do mock foram implementadas na T-007.
- **Limite da evidência.** O teste `test/rejection.test.cjs` usa servidor controlado e cobre as duas chaves de motivo. A verificação com o mock real devolveu 201, `rejectionReason: "contact_info_not_allowed"`, GET 200 e a linha no banco. O primeiro `npm test` falhou com 500 onde o teste esperava 201; depois da implementação, os cinco testes passaram.

## T-005 • Preço em centavos

- O `price` continua em reais na entrada e na saída da API; o banco passou a guardar `priceCents integer`. A migration `AddPriceCents1795622400000` adiciona a coluna, faz backfill com `ROUND(price * 100)`, exige `> 0`, remove a coluna `numeric` antiga e recusa dados legados com mais de 2 casas decimais em vez de arredondar silenciosamente. A migration inicial não foi editada.
- A conversão de entrada usa a representação decimal: `800.25` vira a string `"800" + "25"` e o inteiro `80025`; não há `price * 100` em ponto flutuante. `fromCents` devolve o número em reais para o mapper `toAdResponse`. O campo `priceCents` não aparece na resposta HTTP.
- Alternativas descartadas: manter `numeric` com scale 2 (ainda depende de arredondamento), usar transformer no mesmo campo (esconde a unidade e deixa a entidade ambígua) e multiplicar o `number` por 100 (reintroduz o problema que a decisão quer evitar).
- A entidade `Ad` agora tem `priceCents`; `AdsService.create` converte uma vez, antes de salvar, e `findById` usa o mesmo mapper. `ModerationClient` continua recebendo o preço em reais.
- **Limite da evidência.** O teste `test/price.test.cjs` cobre API/banco e o `test/money.test.cjs` cobre a conversão pura. O backfill foi conferido em um banco temporário com uma linha legada `800.25`, que virou `80025`. A suíte não roda o `down` da migration. Os sete testes daquela etapa passaram.

## T-006 • Listagem paginada e filtro

- A persistência saiu do `AdsService` para o `AdsRepository`: `create`, `save`, `findById` e `findApprovedPage`. O serviço ficou com moderação, conversão de centavos, 404, mapper e montagem da resposta. Alternativa descartada: continuar usando `DataSource.getRepository` direto no serviço; funcionava, mas espalharia `where`/`order`/`skip`/`take` na regra de aplicação assim que novas buscas aparecessem.
- Paginação `page`/`pageSize`, 1-based, padrão 1/20, máximo 100; resposta `{data, page, pageSize, total, totalPages}`. Alternativas descartadas: `limit`/`offset` (menos legível) e cursor/keyset (overkill para o volume do desafio, que fica registrado como evolução).
- Ordem `createdAt DESC, id DESC` para desempate determinístico. A consulta de aprovados fica no repositório (`findApprovedPage`); o serviço decide paginação, montagem da resposta e mapper. Os reprovados continuam no detalhe. Alternativa descartada: incluir reprovados no catálogo público sem autenticação, o que misturaria visões de comprador e vendedor.
- Query validada pelo mesmo `ZodValidationPipe`: `page`/`pageSize` inválidos e categoria fora do contrato retornam 400 antes do banco. `totalPages` é `Math.ceil(total / pageSize)`; página além do fim devolve `data: []`.
- Dois índices parciais `WHERE status = 'approved'`: `(status, "createdAt" DESC, id DESC)` e `(status, category, "createdAt" DESC, id DESC)`. Com 57 linhas o planner pode preferir `Seq Scan`; os índices são para volume maior e foram validados com plano forçado (Index Scan sem `Sort`).
- **Limite da evidência.** A suíte cobre paginação/filtro/ordem com fixtures SQL e não mede carga; `OFFSET` profundo e `COUNT(*)` continuam sendo o custo a evoluir para keyset. A migration de índices não tem teste de plano (`EXPLAIN`) automatizado.

## T-007 • Falhas do serviço de moderação

- Duas tentativas no máximo para `429`, `5xx`, timeout e erro de rede; uma tentativa para `400` e status desconhecido. O `Retry-After` do 429 é respeitado com teto de 1 s; o backoff padrão é 200 ms e o timeout por tentativa é 3 s. Alternativa descartada: retry infinito/circuit breaker — overkill para o desafio e aumentaria a latência sem ganho proporcional.
- Depois de esgotar as tentativas, o cliente lança `ModerationUnavailableError`; o controller responde **503** com `Retry-After: 1`. `400` ou `200` com status desconhecido lançam `ModerationProtocolError` e viram **502**. A moderação acontece antes do `save`, então nenhuma falha técnica grava anúncio.
- `200 rejected` continua sendo resposta válida: persiste `rejected` com motivo e não faz retry. O `ModerationClient` não conhece HTTP de resposta; o controller traduz os erros para 503/502, mantendo a borda HTTP no controller.
- `MODERATION_TIMEOUT_MS` e `MODERATION_RETRY_BACKOFF_MS` existem para os testes não esperarem 3 s/200 ms; os defaults de produção continuam 3000/200.
- **Limite da evidência.** O teste `test/moderation.test.cjs` usa servidor controlado e cobre 500→200, 429→200, 500 sempre, timeout sempre, 400, status desconhecido e rejected. Não testei um 429 real do mock nem o comportamento sob carga concorrente; o pior caso teórico é ~6–7 s.

## T-009 • Seed de demonstração

- O seed é um script manual (`npm run seed`) em `scripts/seed.cjs`, que lê o `backend/api-mock/seed/ads.json` fornecido e insere 57 anúncios `approved` direto no banco, com UUID, `priceCents`, `createdAt` e imagens placeholder do Picsum. O arquivo do mock não é alterado. Alternativa descartada: importar no startup — poluiria produção, dependeria do arquivo do mock e atrasaria o boot.
- O script exige base vazia e recusa a execução se já houver linhas, para não duplicar. Alternativa descartada: `TRUNCATE`/sobrescrever — destrutivo e surpreendente.
- Os 57 anúncios **não** passam pela moderação. Seriam 57 chamadas, com 20% de erro e limite de 5 req/s; o seed é dado de demonstração, não um fluxo de publicação. Alternativa descartada: chamar o mock para cada anúncio.
- O seed fornecido não tem `images`; usamos `https://picsum.photos/seed/anuncio-{id}/640/480` como placeholder estável. As cinco categorias presentes (não há `colecionaveis`) e os preços conferem com as faixas do mock.
- **Evidência.** `test/seed.test.cjs` sobe a API, limpa a tabela, chama `seedDatabase`, verifica 57 linhas na API, contagem de `veiculos` e imagens, e confirma que a segunda execução recusa sem alterar os dados. O teste roda no `anuncios_test`, limpa o que criou e não depende do banco de desenvolvimento. Limite: ele exercita a função exportada, não o processo `npm run seed` nem o exit code da CLI; a execução manual da CLI foi feita antes do teste automatizado.

## Testes • `node:test` e integração

- Mantivemos o runner nativo do Node (`node:test`) e testes de integração pela borda HTTP: Nest real, Postgres `anuncios_test`, migrations reais e um servidor HTTP controlado no lugar do mock. O desenho está em [`test/README.md`](test/README.md) e os helpers em [`test/support/helpers.cjs`](test/support/helpers.cjs).
- Alternativa descartada: Jest + `@nestjs/testing` (`TestModule`) + `.spec.ts`. Exigiria dependências novas, configuração de TS/Jest e outro script; com banco real o ganho seria pequeno, e com `DataSource` mockado a suíte deixaria de provar persistência, constraints e migrations. `TestModule` continua sendo a opção se o serviço ganhar muitos providers e a necessidade de testes de unidade com DI.
- A suíte usa `--test-concurrency=1` porque os arquivos compartilham o mesmo banco e aplicam migrations na inicialização. O teste unitário de conversão de centavos roda diretamente com `node:test`.
- **Limite da evidência.** Os testes de integração dependem do PostgreSQL na porta 5433. A suíte verifica comportamento funcional. Medições de carga ficaram fora do escopo. O mock real não é usado nos testes automatizados por causa do erro aleatório e do limite de 5 req/s.

## Decisão transversal • Casos de uso e DTOs

- Mantemos o `AdsService` com um método por ação (`create`, `findById` e `list`) em vez de criar um arquivo `.usecase.ts` para cada ação. Esses métodos já são os casos de uso: orquestram a moderação, a persistência e o 404. Alternativa considerada: o padrão usado na Flash, com `create-ad.usecase.ts`, `get-ad.usecase.ts` e classes de DTO; descartada nesta fase porque adicionaria arquivos, injeção e indireção sem mudar comportamento, e o avaliador valoriza proporcionalidade.
- O `ad.schema.ts` é o DTO de entrada: o Zod valida em runtime, infere o tipo e produz os detalhes do 400. Não criamos um `.dto.ts` separado com `class-validator`; isso duplicaria a mesma regra em dois formatos. Alternativa considerada: DTO com decorators e `ValidationPipe`; descartada por exigir dependências novas e mais cerimônia.
- Desde a T-005, `toAdResponse` transforma a entidade em `AdResponse` e converte centavos para reais na resposta HTTP.
- **Critério para reavaliar:** mais de ~6 endpoints, transações com múltiplos colaboradores, autorização ou políticas que variem por ação. Antes disso, o custo de um caso de uso por arquivo não se paga.
- A reorganização de pastas em `infra/db`/`services` não foi decidida nesta fatia; a estrutura feature-first atual continua valendo até uma decisão explícita.

## Tempo e retrospectiva

- **Tempo aproximado:** 6–8 horas de trabalho efetivo, incluindo leitura do enunciado, análise inicial, implementação em fatias, testes, revisão independente e documentação. O prazo do desafio era de 7 dias corridos, com esforço esperado de 4–6 horas; o excedente foi usado principalmente na revisão e na documentação.
- **O que faria diferente com mais tempo:**
  - teria implementado a T-007 (falhas do mock) antes da T-005/T-006, para fechar o contrato externo mais cedo e evitar a promessa de “próxima fatia” na documentação;
  - adicionaria idempotência (`Idempotency-Key` + tabela) para o `POST /ads`, cobrindo retry do cliente após timeout;
  - evoluiria a listagem para keyset/cursor e mediria `OFFSET`/`COUNT(*)` com carga, em vez de só validar os índices com `EXPLAIN` forçado no seed;
  - separaria as migrations de `database.ts` em `src/infra/db/migrations` e o cliente de moderação em `src/infra/moderation`, como discutido, se o projeto crescer;
  - adicionaria logs estruturados/correlação para diagnosticar falhas do mock e um contrato OpenAPI gerado a partir dos schemas;
  - rodaria a suíte em CI e em uma máquina limpa, com uma verificação da CLI `npm run seed` e do seu código de saída. A suíte já cobre a função `seedDatabase` no banco de teste.
- O que **não** mudaria: a escolha de `node:test` com integração HTTP/Postgres real, o Zod como contrato de entrada, os centavos no banco, o 201 para reprovado e a separação controller → service → repositório.

## Revisão de entrega

A revisão de entrega amplia a coluna de centavos para bigint por migration. Isso permite persistir a reprovação por preço acima do limite anterior do PostgreSQL. Um teto no antigo limite de 32 bits impediria a consulta dessas reprovações. O contrato JSON usa number, por isso a validação limita os centavos à precisão inteira segura. O rollback para integer requer que os valores caibam no tipo anterior.

A API trata uma reprovação sem motivo preenchido como falha do contrato externo (502). Inventar um motivo local atribuiria à moderação uma decisão que ela não informou. O cliente procura um texto preenchido primeiro em `rejection_reason` e depois em `reason`.
