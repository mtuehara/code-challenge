# Como trabalhar neste projeto

- Leia o enunciado em `backend/README.md`, o contrato em `backend/api-mock/docs-candidato/API.md` e a especificação em `specs/anuncios/` antes de alterar comportamento.
- Trate o mock como serviço externo. Integre via HTTP e preserve o código fornecido. Regras de conteúdo e faixas de preço pertencem à moderação.
- Trabalhe em uma fatia por vez. Escreva um teste observável pela API, confirme a falha esperada, implemente e rode a suíte. Registre o comando e o resultado.
- Execute `docker compose up -d --wait postgres-test`, `npm ci` e `npm test` na raiz. A suíte usa exclusivamente anuncios_test na porta 5433.
- Ao mudar o contrato, atualize exemplos do README e critérios afetados. Registre escolhas e alternativas em DECISIONS.md e uso real de IA em AI_USAGE.md.
- Faça commits pequenos e revisáveis. Preserve alterações locais do candidato. Confirme com ele os dados pessoais da entrega e o envio ao recrutador.
