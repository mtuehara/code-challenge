# Estado da entrega

A stack aprovada e a implementação estão na raiz. NestJS, Postgres, TypeORM e Zod. A suíte usa Node 24 e HTTP. A listagem pública contém apenas aprovados, a reprovação persiste com motivo e as falhas externas interrompem a gravação. O adaptador aceita os campos reason e rejection_reason, conforme DECISIONS.md.

| Tarefa | Comando ou observação | Resultado |
| --- | --- | --- |
| T-001 | docker compose up -d --wait postgres-test | Banco isolado saudável. Remoto privado confirmado, sem fork. |
| T-002 | npm test | POST retornou 404 antes da rota. Depois retornou 201 e o GET após reinício recuperou o anúncio. |
| T-003 | npm test | A reprovação passou de 500 para 201 com motivo no detalhe. |
| T-004 | npm test | Título de 9 caracteres passou de 201 para 400. Limites inclusivos passaram. |
| T-005 | npm test | Seis cenários falharam antes da tradução de falhas. Depois validaram HTTP e zero linhas gravadas. |
| T-006 | npm test | Listagem passou de 404 para 200 com IDs, totais e páginas corretos. |
| T-007 | node test/smoke.cjs | Dois 201 reais, approved e rejected com price_out_of_range. GET individual e catálogo responderam 200. O cliente repetiu duas tentativas após 503. |
| T-008 | npm ci; npm test; docker compose up -d --build --wait | Instalação e build funcionaram; 12 testes passaram; serviços saudáveis. |

O smoke descobriu o nome alternativo do motivo. O 12º teste reproduziu 502 e passou com 201 após o ajuste no adaptador. Falhas de setup (EACCES no sandbox e uma tentativa durante npm ci sem tsc disponível) foram resolvidas antes de interpretar os testes. O período de 4–6 horas é o esforço esperado. A retrospectiva pessoal e os dados dos avaliadores dependem do candidato.
