# Decisões de engenharia

## T-001 • Ambiente de desenvolvimento e testes

| Escolha | Alternativa considerada e consequência |
| --- | --- |
| TypeScript e NestJS | Um servidor HTTP mínimo em Node reduziria o setup. A experiência do candidato com NestJS pesou mais, pois ele vai explicar e alterar a aplicação ao vivo. Nesta etapa, o módulo apenas inicializa o servidor. |
| PostgreSQL 16 | SQLite simplificaria a execução local. Um banco documental acomodaria atributos diferentes por categoria. Para os campos conhecidos do anúncio, escolhemos um banco relacional com restrições de integridade e suporte às consultas paginadas previstas. O custo imediato é manter um serviço de banco em execução. |
| Docker Compose para os bancos, NestJS local | Rodar toda a aplicação em containers também foi considerado. Durante o desenvolvimento, iniciar o Nest localmente facilita depurar. O Compose mantém duas instâncias: desenvolvimento em 5432 com volume persistente, testes em 5433 com armazenamento temporário. Isso permite exercitar o mesmo motor de banco sem misturar dados. |
| Teste com o runner do Node, HTTP e cliente pg | Jest e Supertest foram considerados. O runner e o fetch do Node já atendem ao teste de prontidão. A conexão SQL direta permite conferir o nome da base antes de implementar a persistência dos anúncios. |

TypeORM e Zod já constam no manifesto para as próximas fatias. TypeORM será usado na persistência. Para a validação de entrada, a experiência anterior do candidato com Zod e a inferência de tipos pesaram na escolha diante dos DTOs com class-validator.

**Limite da evidência.** O [teste de ambiente](test/setup.test.cjs) abre o Nest em porta livre e espera 404 na raiz. Depois, o próprio teste executa `SELECT current_database()` e exige `anuncios_test`. Isso verifica HTTP e isolamento da conexão de teste. A persistência de um anúncio pela aplicação será verificada na T-002.
Atualização da T-001: o teste passou a verificar GET /health com 200 e {"status":"ok"} no lugar do 404 histórico. A rota verifica a disponibilidade HTTP do processo; a suíte continua conferindo o Postgres separadamente.
Para desenvolvimento, npm run start:dev usa Nodemon observando src e tsconfig.json. Cada alteração executa npm start, incluindo a compilação TypeScript com os metadados de decorators do Nest.

## T-002 • Aprovação e persistência

- O candidato aprovou o critério de criar, moderar, persistir e consultar após reiniciar o Nest. O controller cuida de HTTP e Location. O serviço coordena a moderação e a gravação. Usamos diretamente o repository do TypeORM.
- Axios foi solicitado pelo candidato para centralizar baseURL e timeout no cliente da moderação. A alternativa discutida foi fetch. O cliente envia somente os quatro campos previstos no contrato externo e exige HTTP 200 com status approved.
- A migration cria advertisements e roda durante a inicialização. synchronize fica desabilitado. Os testes rodam sequencialmente para evitar duas inicializações concorrentes aplicando a migration na mesma base. Múltiplas réplicas exigiriam executar migrations em uma etapa separada.
- Para esta fatia, escolhemos numeric no Postgres e mantemos price em reais na API. A alternativa discutida anteriormente foi centavos inteiros. Numeric preserva o decimal armazenado, enquanto a interface JSON segue a precisão de number do JavaScript. A política completa de precisão e validação será fechada na fatia de validações.
- Na revisão da T-002, o candidato escolheu centavos inteiros para armazenamento e cálculos. O enunciado exige preço positivo, e o contrato do mock especifica apenas `number`. O campo `price` continua em reais na API e no mock. A mudança pendente deve validar a precisão na entrada, converter pela representação decimal sem multiplicação em ponto flutuante e usar inteiros na lógica de negócio.
- O POST aguarda a aprovação antes de inserir. A conexão com o banco é encerrada junto com a aplicação. O teste fecha e reabre o Nest para conferir que o GET depende da persistência.
- A restrição de status na migration admite approved nesta fatia. A próxima migration deverá acrescentar rejected quando implementarmos a reprovação com motivo.

## T-003 • Validação de entrada

- O candidato aprovou validar a entrada antes da moderação e contar o título depois do `trim`. O schema Zod fica em `src/ads/ad.schema.ts` e o pipe em `src/ads/zod-validation.pipe.ts`; o `CreateAdInput` passou a ser inferido do schema e saiu da entidade. Alternativa descartada: `class-validator` com DTOs, que exigiria dependências novas e mais decorators para o mesmo resultado.
- O título é trimado antes de contar e o valor trimado é o persistido. Um título de 9 caracteres visíveis, mesmo com espaços nas pontas, é recusado; um de 10 a 100 é aceito. Alternativa descartada: contar o valor bruto, que rejeitaria espaços benignos.
- O preço é aceito apenas como número JSON finito, maior que zero e com no máximo 2 casas decimais. A conversão para centavos e a migration ficam para a T-005; até lá o banco continua `numeric`, mas a API já impede valores como `800.255`. Alternativa descartada: arredondar silenciosamente.
- A categoria é validada localmente contra as seis categorias do mock para devolver 400 antes da chamada externa. As faixas de preço continuam na moderação, conforme `AGENTS.md`. Alternativa descartada: deixar a categoria para a moderação e traduzir o 400 externo, o que gastaria uma chamada de rede para um erro previsível.
- Erro de validação: 400 com `{statusCode, error, message, details}`; a moderação não é chamada e nenhuma linha é gravada. Campos desconhecidos são ignorados. Alternativa descartada: corpo default do Nest, que mistura formatos entre validação, 404 e 503.
- **Limite da evidência.** O teste `test/validation.test.cjs` usa um servidor de moderação controlado e o Postgres de teste; não usa o mock real. A T-004 cobre reprovação e a T-005 cobre centavos. O primeiro `npm test` falhou com 201 onde o teste esperava 400; depois da implementação, os quatro testes passaram.

## T-004 • Reprovação persistida

- O candidato escolheu `201` para anúncio reprovado, com `status: "rejected"` e `Location`, em vez de `422`. O recurso é criado e persiste; o status e o motivo ficam no corpo. Alternativa descartada: `422`, que sinaliza rejeição mas ou não persiste ou devolve um código que normalmente significa “não processei”.
- O cliente passou a devolver um resultado (`approved` ou `rejected` com motivo), em vez de lançar erro para qualquer status diferente de `approved`. O serviço grava `status` e `rejectionReason` na mesma operação; o controller não mudou e o 201 continua sendo o padrão do `POST`.
- O mock real devolve `rejection_reason`; o `API.md` documenta `reason`. O cliente lê `rejection_reason` primeiro e `reason` como fallback, e a API expõe `rejectionReason`. Alternativa descartada: ler apenas `reason`, que deixaria o motivo nulo no mock real.
- Migration nova `AddRejectedStatus1795536000000` troca o `CHECK (status = 'approved')` por `CHECK (status IN ('approved', 'rejected'))`. A migration inicial não foi editada. O `down` restaura a restrição antiga e só é seguro se não houver reprovados; isso está documentado no código.
- O tipo `status` da entidade passou a ser `'approved' | 'rejected'`; `rejectionReason` continua nullable. A listagem e a exclusão de reprovados ficam para a T-006; falhas do mock permanecem 500 até a T-007.
- **Limite da evidência.** O teste `test/rejection.test.cjs` usa servidor controlado e cobre as duas chaves de motivo. A verificação com o mock real devolveu 201, `rejectionReason: "contact_info_not_allowed"`, GET 200 e a linha no banco. O primeiro `npm test` falhou com 500 onde o teste esperava 201; depois da implementação, os cinco testes passaram.

## T-005 • Preço em centavos

- O `price` continua em reais na entrada e na saída da API; o banco passou a guardar `priceCents integer`. A migration `AddPriceCents1795622400000` adiciona a coluna, faz backfill com `ROUND(price * 100)`, exige `> 0`, remove a coluna `numeric` antiga e recusa dados legados com mais de 2 casas decimais em vez de arredondar silenciosamente. A migration inicial não foi editada.
- A conversão de entrada usa a representação decimal: `800.25` vira a string `"800" + "25"` e o inteiro `80025`; não há `price * 100` em ponto flutuante. `fromCents` devolve o número em reais para o mapper `toAdResponse`. O campo `priceCents` não aparece na resposta HTTP.
- Alternativas descartadas: manter `numeric` com scale 2 (ainda depende de arredondamento), usar transformer no mesmo campo (esconde a unidade e deixa a entidade ambígua) e multiplicar o `number` por 100 (reintroduz o problema que a decisão quer evitar).
- A entidade `Ad` agora tem `priceCents`; `AdsService.create` converte uma vez, antes de salvar, e `findById` usa o mesmo mapper. `ModerationClient` continua recebendo o preço em reais.
- **Limite da evidência.** O teste `test/price.test.cjs` cobre API/banco e o `test/money.test.cjs` cobre a conversão pura. O backfill foi conferido em um banco temporário com uma linha legada `800.25`, que virou `80025`. A suíte não roda o `down` da migration. Os sete testes passam depois da implementação.

## T-006 • Listagem paginada e filtro

- A persistência saiu do `AdsService` para o `AdsRepository`: `create`, `save`, `findById` e `findApprovedPage`. O serviço ficou com moderação, conversão de centavos, 404, mapper e montagem da resposta. Alternativa descartada: continuar usando `DataSource.getRepository` direto no serviço; funcionava, mas espalharia `where`/`order`/`skip`/`take` na regra de aplicação assim que novas buscas aparecessem.
- Paginação `page`/`pageSize`, 1-based, padrão 1/20, máximo 100; resposta `{data, page, pageSize, total, totalPages}`. Alternativas descartadas: `limit`/`offset` (menos legível) e cursor/keyset (overkill para o volume do desafio, que fica registrado como evolução).
- Ordem `createdAt DESC, id DESC` para desempate determinístico. A listagem filtra `status = 'approved'`; os reprovados continuam no detalhe. Alternativa descartada: incluir reprovados no catálogo público sem autenticação, o que misturaria visões de comprador e vendedor.
- Query validada pelo mesmo `ZodValidationPipe`: `page`/`pageSize` inválidos e categoria fora do contrato retornam 400 antes do banco. `totalPages` é `Math.ceil(total / pageSize)`; página além do fim devolve `data: []`.
- Dois índices parciais `WHERE status = 'approved'`: `(status, "createdAt" DESC, id DESC)` e `(status, category, "createdAt" DESC, id DESC)`. Com 57 linhas o ganho é irrelevante; a decisão demonstra o caminho de evolução e combina com a ordem/filtro reais.
- **Limite da evidência.** A suíte cobre paginação/filtro/ordem com fixtures SQL e não mede carga; `OFFSET` profundo e `COUNT(*)` continuam sendo o custo a evoluir para keyset. A migration de índices não tem teste de plano (`EXPLAIN`) automatizado.

## Testes • `node:test` e integração

- Mantivemos o runner nativo do Node (`node:test`) e testes de integração pela borda HTTP: Nest real, Postgres `anuncios_test`, migrations reais e um servidor HTTP controlado no lugar do mock. O desenho está em [`test/README.md`](test/README.md) e os helpers em [`test/support/helpers.cjs`](test/support/helpers.cjs).
- Alternativa descartada: Jest + `@nestjs/testing` (`TestModule`) + `.spec.ts`. Exigiria dependências novas, configuração de TS/Jest e outro script; com banco real o ganho seria pequeno, e com `DataSource` mockado a suíte deixaria de provar persistência, constraints e migrations. `TestModule` continua sendo a opção se o serviço ganhar muitos providers e a necessidade de testes de unidade com DI.
- A suíte usa `--test-concurrency=1` porque os arquivos compartilham o mesmo banco e aplicam migrations na inicialização. Testes de unidade puros (por exemplo, conversão de centavos na T-005) podem ser adicionados sem Nest, sem banco e sem dependência nova.
- **Limite da evidência.** A suíte depende de Docker/Postgres em 5433 e roda em ~18 s; não é unitária e não substitui um teste de carga. O mock real não é usado nos testes automatizados por causa do erro aleatório e do limite de 5 req/s.

## Decisão transversal • Casos de uso e DTOs

- Mantemos o `AdsService` com um método por ação (`create`, `findById` e, depois, `list`) em vez de criar um arquivo `.usecase.ts` para cada ação. Esses métodos já são os casos de uso: orquestram a moderação, a persistência e o 404. Alternativa considerada: o padrão usado na Flash, com `create-ad.usecase.ts`, `get-ad.usecase.ts` e classes de DTO; descartada nesta fase porque adicionaria arquivos, injeção e indireção sem mudar comportamento, e o avaliador valoriza proporcionalidade.
- O `ad.schema.ts` é o DTO de entrada: o Zod valida em runtime, infere o tipo e produz os detalhes do 400. Não criamos um `.dto.ts` separado com `class-validator`; isso duplicaria a mesma regra em dois formatos. Alternativa considerada: DTO com decorators e `ValidationPipe`; descartada por exigir dependências novas e mais cerimônia.
- Um contrato de saída explícito (mapper `AdResponse`) passa a valer quando a T-005 converter centavos e a entidade deixar de ser devolvida diretamente. Não é um DTO de entrada extra; é a borda de resposta.
- **Critério para reavaliar:** mais de ~6 endpoints, transações com múltiplos colaboradores, autorização ou políticas que variem por ação. Antes disso, o custo de um caso de uso por arquivo não se paga.
- A reorganização de pastas em `infra/db`/`services` não foi decidida nesta fatia; a estrutura feature-first atual continua valendo até uma decisão explícita.
