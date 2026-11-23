# Code Challenge — Grupo OLX

## Ambiente de desenvolvimento

Na raiz, com Docker Compose e Node 24:

```sh
docker compose up -d --wait postgres postgres-test
npm ci
npm test
```

Os testes compilam o NestJS, iniciam um servidor em porta livre e verificam o acesso SQL ao banco dedicado `anuncios_test` (5433). O banco de desenvolvimento `anuncios` usa a porta 5432 e um volume persistente. O desenho da suíte, os helpers e o motivo de usar `node:test` estão em [`test/README.md`](test/README.md).

Para iniciar a API local, execute `npm start` e mantenha o terminal aberto. O comando compila a aplicação e imprime a URL de verificação. Abra [GET /health](http://localhost:3000/health) no navegador. A resposta esperada é HTTP 200 com `{"status":"ok"}`. Essa rota verifica se o processo Nest atende HTTP. A conexão com o banco é verificada separadamente pela suíte.

Para desenvolver com reinício automático, execute `npm run start:dev`. O Nodemon observa `src` e `tsconfig.json` e executa `npm start` após cada alteração. Encerre com Ctrl+C. No PowerShell, caso a política bloqueie `npm.ps1`, use `npm.cmd run start:dev`.

Se aparecer `EADDRINUSE`, a porta já está ocupada. No PowerShell, use `$env:PORT = '3001'` antes de `npm start` e abra a URL impressa no terminal.

## Criar e consultar um anúncio aprovado (T-002)

Inicie também o mock fornecido e a aplicação:

```sh
docker compose -f backend/api-mock/docker-compose.yml up -d --wait
npm run start:dev
```

O Nest conecta ao banco de desenvolvimento na porta 5432 e aplica as migrations automaticamente. `DATABASE_URL` permite alterar a conexão e `MODERATION_URL` define a URL do serviço externo (padrão `http://localhost:8787`). A chamada Axios tem timeout de 3 segundos.

Em outro terminal PowerShell:

```powershell
$body = @{
  title = 'Bicicleta urbana'
  description = 'Bicicleta usada em bom estado.'
  price = 800.25
  category = 'esportes'
  images = @('https://example.org/bicicleta.jpg')
} | ConvertTo-Json
$ad = Invoke-RestMethod http://localhost:3000/ads -Method Post -ContentType application/json -Body $body
Invoke-RestMethod "http://localhost:3000/ads/$($ad.id)"
```

O cliente envia `price` em reais, como número JSON. No exemplo, `800.25` representa R$ 800,25 e é enviado nesse formato também à moderação. Desde a T-005, o banco guarda `priceCents` inteiro — `80025` — para evitar erros de ponto flutuante nos cálculos; a API continua recebendo e devolvendo `800.25` em reais. A conversão usa a representação decimal, sem multiplicar o `number` por 100.

Com aprovação da moderação, `POST /ads` retorna 201 e `Location: /ads/{id}`. `GET /ads/{id}` retorna 200 com o mesmo objeto:

```json
{
  "id": "692d0134-3e35-4158-b40d-4cffab8582e6",
  "title": "Bicicleta urbana",
  "description": "Bicicleta usada em bom estado.",
  "price": 800.25,
  "category": "esportes",
  "images": ["https://example.org/bicicleta.jpg"],
  "status": "approved",
  "rejectionReason": null,
  "createdAt": "2026-11-23T17:40:30.177Z"
}
```

Um UUID inexistente retorna 404 e um ID malformado retorna 400. A suíte chama a moderação por HTTP contra um servidor controlado, reinicia o Nest e recupera o anúncio usando a mesma base. Ela remove somente o registro criado pelo teste.

As T-002 a T-007 cobrem criação, validação, aprovação, reprovação, listagem e falhas do serviço externo. Falhas do mock não gravam anúncio: 429/5xx/timeout viram 503 após duas tentativas; 400 ou resposta desconhecida viram 502.

## Validação de entrada (T-003)

`POST /ads` valida o corpo antes de chamar a moderação. As regras são:

- `title`: string, com espaços nas pontas removidos, entre 10 e 100 caracteres; o banco recebe o título já trimado;
- `description`: string não vazia;
- `price`: número JSON finito, maior que zero e com no máximo 2 casas decimais;
- `category`: uma das categorias do mock (`eletronicos`, `moveis`, `veiculos`, `imoveis`, `esportes`, `colecionaveis`); as faixas de preço continuam sendo responsabilidade da moderação;
- `images`: lista com ao menos uma string não vazia.

Campos desconhecidos são ignorados. Payload inválido retorna 400 com os campos problemáticos e **não** chama a moderação nem grava anúncio:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Dados inválidos.",
  "details": [
    { "field": "title", "message": "O título deve ter entre 10 e 100 caracteres." }
  ]
}
```

O teste `test/validation.test.cjs` cobre título, descrição, preço, categoria e imagens, além dos limites de 10 e 100 caracteres. A fatia ainda não altera o armazenamento do preço: a T-005 passará a guardar centavos.

## Reprovação (T-004)

Quando a moderação responde 200 com `{"status":"rejected"}`, o anúncio também é gravado, mas com `status: "rejected"` e o motivo em `rejectionReason`. O `POST /ads` continua retornando 201 com `Location: /ads/{id}`, e o `GET /ads/{id}` devolve o mesmo recurso. Exemplo:

```json
{
  "id": "2e1a027a-3e80-4763-b31d-ef9341941446",
  "title": "Bicicleta com whatsapp",
  "description": "Fale comigo no whatsapp.",
  "price": 800.25,
  "category": "esportes",
  "images": ["https://example.org/bicicleta.jpg"],
  "status": "rejected",
  "rejectionReason": "contact_info_not_allowed",
  "createdAt": "2026-11-23T19:54:45.436Z"
}
```

O mock real devolve o motivo em `rejection_reason`; o `API.md` do mock documenta `reason`. O cliente aceita as duas chaves e expõe o valor como `rejectionReason`. A migration `AddRejectedStatus1795536000000` amplia o `CHECK` da coluna `status` para aceitar `approved` e `rejected`; a migration inicial não foi editada. A reprovação não aparece na listagem (T-006): a decisão é excluí-la do catálogo público e mantê-la acessível pelo detalhe.

## Preço em centavos (T-005)

`price` continua sendo um número em reais na entrada e na saída. No banco, a coluna passou a ser `priceCents integer`: `800.25` vira `80025`, `0.1` vira `10` e `1` vira `100`. A migration `AddPriceCents1795622400000` adiciona a coluna, faz o backfill das linhas existentes, cria o `CHECK ("priceCents" > 0)` e remove a coluna `numeric` antiga. Ela recusa dados legados com mais de 2 casas decimais em vez de arredondar silenciosamente.

A resposta HTTP não expõe `priceCents`: o mapper `toAdResponse` devolve `price` em reais. A conversão de entrada usa a string decimal (`"800.25"` → `80025`), sem `price * 100` em ponto flutuante. Preço com mais de 2 casas continua retornando 400.

## Listagem (T-006)

`GET /ads` lista somente anúncios aprovados, com paginação e filtro opcional por categoria:

| Parâmetro | Padrão | Regra |
|---|---|---|
| `page` | `1` | inteiro ≥ 1; 1-based |
| `pageSize` | `20` | inteiro entre 1 e 100 |
| `category` | — | opcional; uma das seis categorias do mock |

A ordem é `createdAt DESC, id DESC`, para que a paginação seja determinística. Parâmetro ausente usa o padrão; valor vazio (`?page=`, `?category=`) é inválido e retorna 400. A resposta tem `data`, `page`, `pageSize`, `total` e `totalPages`; sem resultados, `total` e `totalPages` são 0:

```json
GET /ads?page=1&pageSize=1&category=esportes
{
  "data": [
    {
      "id": "00000000-0000-4000-8000-000000000002",
      "title": "Anuncio intermediario de esportes",
      "description": "Descrição do anúncio de teste.",
      "price": 200,
      "category": "esportes",
      "images": ["https://example.org/teste.jpg"],
      "status": "approved",
      "rejectionReason": null,
      "createdAt": "2026-01-02T10:00:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 1,
  "total": 2,
  "totalPages": 2
}
```

Query inválida retorna 400 com `details`. Uma página além do fim retorna 200 com `data: []`. Os reprovados ficam fora da listagem, mas continuam acessíveis por `GET /ads/{id}`. O acesso ao banco fica em `AdsRepository`; o serviço coordena paginação, mapper e resposta.

A migration `AddListingIndexes1795708800000` cria dois índices parciais para `status = 'approved'`: um para a ordem global e outro para o filtro por categoria. Com 57 anúncios o planner pode preferir `Seq Scan`; os índices existem para volume maior e foram validados com o plano forçado (Index Scan sem `Sort`), não como uma promessa de ganho no seed.

## Falhas do mock (T-007)

O `POST /ads` aguarda a moderação, mas não transforma falha técnica em 500 genérico:

| Situação | Comportamento |
|---|---|
| `200 approved` | persiste aprovado e retorna 201 |
| `200 rejected` | persiste reprovado com motivo e retorna 201 |
| `429`, `5xx`, timeout ou erro de rede | tenta de novo uma vez; respeita `Retry-After` (teto de 1 s) no 429; depois de duas tentativas retorna **503** com `Retry-After: 1` e **não grava** |
| `400` ou `200` com status desconhecido | **502**, sem retry e sem gravar |

O timeout por tentativa é 3 s e o backoff padrão é 200 ms. Em testes, `MODERATION_TIMEOUT_MS` e `MODERATION_RETRY_BACKOFF_MS` permitem reduzir esses valores. O pior caso é de aproximadamente 6–7 s; o caminho normal continua dominado pela latência do mock (100–2000 ms).

## Seed de demonstração (T-009)

Com o banco de desenvolvimento vazio e as migrations aplicadas. Atenção: `npm test` usa o banco de **teste** (`anuncios_test`, 5433) e **não** migra o banco de desenvolvimento (`anuncios`, 5432). Prepare assim:

```sh
docker compose up -d --wait postgres
npm start          # aplica as migrations; encerre com Ctrl+C
npm run seed
```

O seed não aplica migrations sozinho.

O script lê [`backend/api-mock/seed/ads.json`](backend/api-mock/seed/ads.json) — o arquivo fornecido, que não é alterado — e insere os **57 anúncios** como `approved`, com UUID, `priceCents`, `createdAt` original e uma imagem placeholder estável no Picsum (`https://picsum.photos/seed/anuncio-{id}/640/480`). O seed fornecido não tem imagens; o placeholder é só para a demonstração da listagem.

O script **só roda em base vazia**. Se já existir qualquer anúncio, ele para com mensagem de erro em vez de duplicar. Não passa os 57 anúncios pela moderação: isso faria 57 chamadas, sofreria com o erro aleatório/limite de 5 req/s e não é o objetivo do seed.

Olá! Que bom ter você por aqui.

## Propósito

Queremos entender como você pensa para resolver problemas, como organiza seu código, como toma decisões técnicas e como usa as ferramentas que tem à disposição, inclusive IA.

Não buscamos a solução perfeita. Buscamos uma solução que você entende, sabe justificar e saberia evoluir.

## O desafio

Escolha a trilha correspondente à vaga e siga as instruções do respectivo README:

- [Backend](./backend/README.md)

## Sobre o uso de IA

O uso de IA não só está autorizado como é encorajado e faz parte da avaliação. Ferramentas gratuitas são suficientes (ChatGPT, Claude, Gemini e Copilot têm planos gratuitos).

Avaliamos o seu senso crítico e o seu entendimento do resultado, não o plano que você assina. Você é responsável por cada linha entregue, tenha sido escrita por você ou por uma IA.

## Como desenvolver

1. Crie um repositório privado novo com o conteúdo deste repositório. Não use fork: forks de repositório público são sempre públicos.
2. Faça commits incrementais ao longo do desenvolvimento. O histórico nos ajuda a entender a evolução do seu raciocínio.

## O que entregar

1. **Código funcional**, com instruções de execução no `README.md` do seu repositório (um comando ou poucos passos). Prezamos muito por documentação: faça do README o seu cartão de visita.
2. **`DECISIONS.md`** com:
   - decisões técnicas relevantes, alternativas consideradas e por que foram descartadas;
   - requisitos que ficaram ambíguos, a interpretação que você escolheu e por quê;
   - tempo aproximado gasto e o que faria diferente com mais tempo.
3. **`AI_USAGE.md`** com:
   - quais ferramentas de IA usou e em quais etapas;
   - exemplos de prompts ou fluxos que funcionaram;
   - o que a IA gerou que você rejeitou ou corrigiu, e por quê;
   - como você validou o que foi gerado.

   Não é pegadinha: usar IA bem conta a favor. Não precisa enviar o histórico completo das conversas.
4. **Testes** dos fluxos que você considera críticos. Cobertura total não é exigida; a escolha do que testar também é avaliada.

## Como vamos avaliar

Sua entrega será avaliada por no mínimo 2 engenheiros do Grupo OLX, em duas etapas: a leitura do repositório e a apresentação.

| Critério | O que observamos | Onde observamos |
| --- | --- | --- |
| **Manutenibilidade** | O código é legível e fácil de alterar? A solução é proporcional ao problema, sem código ou abstrações sobrando? | Código |
| **Desenho** | Como as responsabilidades foram separadas? As fronteiras entre as partes estão claras? | Código |
| **Qualidade** | Os testes cobrem o que realmente importa e validam comportamento? Seria fácil adaptá-los se o comportamento mudasse? | Testes |
| **Documentação** | Quanto do seu projeto alguém consegue entender sem precisar te perguntar nada? | `README.md`, código |
| **Desempenho** | A performance é adequada ao problema? Você entende os gargalos e como evoluiria a solução? | Código, apresentação |
| **Decisões e trade-offs** | Por que você escolheu assim? Que alternativas considerou e descartou? Ambiguidades foram tratadas de forma explícita? | `DECISIONS.md`, apresentação |
| **Uso crítico de IA** | Como você conduziu, validou e corrigiu o que a IA produziu? | `AI_USAGE.md`, apresentação |
| **Domínio da solução** | Você explica qualquer parte do código e consegue alterá-lo? | Apresentação |

O que **não** avaliamos: quantidade de código, número de funcionalidades extras ou quais ferramentas pagas você usou.

Preferimos um escopo menor e bem compreendido a um escopo grande que você não domina. Resolva bem o essencial.

## Entrega

- **Prazo:** 7 dias corridos a partir do recebimento. Se precisar de mais tempo, avise o recrutador antes do fim do prazo.
- **Esforço esperado:** 4 a 6 horas de trabalho no total, não por dia. O prazo é longo de propósito, para caber na sua rotina.
- Ao finalizar, adicione como colaboradores os avaliadores indicados no e-mail do recrutador.
- Avise o recrutador por e-mail quando terminar.
- Vale o conteúdo do repositório no momento do envio do e-mail: **commits posteriores não serão considerados**.

## Apresentação

Depois da entrega, agendamos uma conversa com os avaliadores, numa janela de até 1h30 que pode terminar antes sem nenhum prejuízo:

- você apresenta a solução e as principais decisões;
- conversamos sobre trade-offs, alternativas e o uso de IA;
- podemos pedir uma pequena alteração ou evolução do código ao vivo.

## Dúvidas

Qualquer dúvida sobre o enunciado, fale com o time de Atração.

Bom código! ;)
