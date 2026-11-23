# Anúncios — tarefas

Em cada fatia: declarar comportamento, escrever teste, executar e conferir a causa do vermelho, implementar o mínimo, executar novamente e refatorar com suíte verde. Registrar comandos e resultados reais. Atualizar documentos afetados antes de sugerir o commit da fatia.

| ID | Trabalho e resultado esperado | Requisitos | Depende de | Estado | Evidência |
| --- | --- | --- | --- | --- | --- |
| T-001 | Preparar ambiente e versionamento. Antes de T-002, subir Postgres via Compose, aguardar prontidão, validar conexão SQL e preparar base isolada para os testes. | Suporte ao desenvolvimento | — | concluída | Ver status.md |
| T-002 | Criar aprovado, persistir e consultar pelo ID; verificar persistência entre reinícios | R-001, R-003, R-004, R-008 | T-001 | concluída | Ver status.md |
| T-003 | Persistir reprovação com motivo e retornar 201; consultar pelo ID | R-005, R-008 | T-002 | concluída | Ver status.md |
| T-004 | Validar campos e limites sem chamar dependência ou gravar entrada inválida | R-002, R-008 | T-003 | concluída | Ver status.md |
| T-005 | Tratar timeout, 429, indisponibilidade e resposta inválida sem publicar/persistir | R-007, R-008 | T-004 | concluída | Ver status.md |
| T-006 | Listar com filtro, ordenação, paginação e totais; misturar categorias/estados no teste | R-006, R-008 | T-005 | concluída | Ver status.md |
| T-007 | Executar aprovação e reprovação reais via HTTP contra mock fornecido | R-004, R-005, R-008 | T-006 | concluída | Ver status.md |
| T-008 | Finalizar execução e documentação; seguir README, rodar suíte e confrontar contrato/respostas | R-009 e revisão de R-001 a R-008 | T-007 | em andamento | Execução validada. Retrospectiva pessoal pendente. |

Reservar pelo menos uma hora para T-007/T-008, ajustando o esforço após setup. Pedir ao usuário seu tempo real aproximado e discutir o que faria com mais tempo. AI_USAGE registra apenas ferramentas, prompts, correções e verificações que realmente aconteceram.

Commits sugeridos acompanham mudanças reais: especificação; caminho aprovado; reprovação; validações; falhas da dependência; listagem; execução/documentação final. Não realizar commits sem verificar o estado do repositório.
