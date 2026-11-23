# Uso de IA

Trabalhamos em par com Codex no planejamento, modelagem, implementação, testes e documentação. O candidato revisou o contrato e as escolhas antes das primeiras fatias.

| Interação real | Efeito na entrega |
| --- | --- |
| “pq sqlite ao inves de postgres?” e “mas entre sql e nosql qual e por que?” | Reavaliamos a proposta inicial de SQLite e adotamos Postgres. |
| “consegue fazer um prototipo em uml para comecarmos a discutir os primeiros passos?” | Desenhamos a entidade, o fluxo e a fronteira HTTP da moderação. |
| “acho, que prefiro zod. eu ja usei ele na flash” | A preferência do candidato definiu a validação da entrada. |
| “acha que montar o container do postgres nao seria um pre requisito tbm?” | O candidato corrigiu o plano. Validamos prontidão e uma consulta SQL antes da primeira fatia. |
| “gosto tbm de criarmos exceptions/errors para retornar os erros” | Implementamos subclasses de BaseError quando os testes de falha exigiram respostas distintas. |
| “não deveríamos criar um AGENT.md para nosso projeto?” | Incluímos AGENTS.md com convenções específicas para os próximos colaboradores. |

## Como validamos

- Cada fatia começou com um teste de comportamento. A primeira execução sem acesso à porta de teste falhou com EACCES. Com o acesso local liberado, observamos o vermelho esperado, 404 em vez de 201.
- A suíte cobriu os comportamentos em 11 testes e recebeu um 12º cenário para a divergência do mock. Reabrimos a aplicação antes de consultar o primeiro anúncio, misturamos categorias e estados na paginação e contamos linhas após falhas externas.
- Subimos o Compose e exercitamos HTTP contra o mock como serviço externo. A aprovação foi observada. A reprovação revelou uma diferença entre o campo documentado e a resposta real. Reproduzimos o caso em um teste controlado (502 em vez de 201) antes de adaptar o cliente para os dois campos. Os 12 testes passaram.
- O candidato ainda precisa revisar o código e praticar uma alteração ao vivo. A execução pela IA não comprova domínio pessoal da solução.

O smoke final passou pelos dois resultados com o mock fornecido após o ajuste. O cliente de demonstração repetiu duas chamadas após 503.
