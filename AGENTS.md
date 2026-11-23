# Como trabalhar neste projeto

- Leia o enunciado em `backend/README.md`, o contrato em `backend/api-mock/docs-candidato/API.md` e a especificação em `specs/anuncios/` antes de alterar comportamento.
- Trate o mock como serviço externo. Integre via HTTP e preserve o código fornecido. Regras de conteúdo e faixas de preço pertencem à moderação.
- Trabalhe em uma fatia por vez. Escreva um teste observável pela API, confirme a falha esperada, implemente e rode a suíte. Registre o comando e o resultado.
- Execute `docker compose up -d --wait postgres-test`, `npm ci` e `npm test` na raiz. A suíte usa exclusivamente anuncios_test na porta 5433.
- Ao mudar o contrato, atualize exemplos do README e critérios afetados. Registre escolhas e alternativas em DECISIONS.md e uso real de IA em AI_USAGE.md.
- Faça commits pequenos e revisáveis. Preserve alterações locais do candidato. Confirme com ele os dados pessoais da entrega e o envio ao recrutador.

## Branch e revisão humana

1. Antes de editar, confira `git status -sb` e abra uma branch de trabalho a partir da base combinada. Commits e pushes do agente devem ir exclusivamente para a branch de trabalho. Preserve a main e o histórico publicado.
2. Abra um pull request pequeno com objetivo, mudança observável, decisões e comandos de verificação com resultados reais. Aponte falhas, riscos e o que ficou sem verificar. Quando a mudança afetar comportamento, inclua o teste que demonstrou a falha e passou com a correção.
3. O candidato lê o diff, confere as evidências e decide se consegue explicar e alterar a solução. Sugira um cenário concreto de revisão. Aguarde a decisão humana sobre a revisão atual, inclusive após correções solicitadas.
4. O merge fica com uma pessoa. O agente pode preparar commits e responder a comentários na branch. Aprovar uma ideia no chat, ter testes verdes ou abrir o PR não autoriza merge, auto-merge ou push direto na main.
