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
- O POST aguarda a aprovação antes de inserir. A conexão com o banco é encerrada junto com a aplicação. O teste fecha e reabre o Nest para conferir que o GET depende da persistência.
- A restrição de status na migration admite approved nesta fatia. A próxima migration deverá acrescentar rejected quando implementarmos a reprovação com motivo.
