# Uso de IA

## T-001 • Planejamento, setup e revisão

O candidato usou o Codex como par para discutir alternativas. O Codex preparou a configuração do NestJS e do TypeScript, os serviços Postgres no Compose, o teste de ambiente, as instruções de execução e o PR. O candidato escolheu a stack e reservou a decisão de merge para revisão humana.

| Trecho real da conversa | Como afetou a solução |
| --- | --- |
| “pq sqlite ao inves de postgres?” | O Codex havia sugerido SQLite pelo custo menor de setup. Depois de discutir a estrutura dos dados e o custo de subir outro serviço, o candidato aprovou Postgres. |
| “acha que montar o container do postgres nao seria um pre requisito tbm?” | O candidato corrigiu a sequência proposta. A T-001 passou a verificar o banco isolado antes da primeira rota de anúncios. |
| “precisamos sempre passar por revisao humana no final” | O candidato definiu o fluxo do projeto. O Codex prepara a mudança em branch e apresenta as verificações. O candidato revisa o diff e decide o merge. |

**Validação realizada pelo Codex.** Na preparação da T-001, `docker compose up -d --wait postgres postgres-test` indicou prontidão dos dois serviços. Em seguida, `npm test` compilou a aplicação e passou um teste que verificou a resposta HTTP e o nome do banco de testes. Os comandos para reproduzir o resultado estão no [README](README.md).

A revisão do PR identificou que faltavam os registros de decisões e uso de IA no commit inicial da T-001 (`16f6602`). O Codex conferiu a árvore desse commit e acrescentou os dois documentos na mesma branch para revisão.
