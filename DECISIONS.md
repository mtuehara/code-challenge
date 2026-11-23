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
