# Decisões

- **Publicação e visibilidade.** Interpretamos a listagem como catálogo público. A criação síncrona grava a decisão externa. Um reprovado existe, recebe 201 e pode ser consultado pelo ID com seu motivo. Sem autenticação no escopo, qualquer pessoa com esse ID pode consultar o detalhe.
- **Falhas técnicas.** Timeout configurável de 3 segundos limita a espera. O cliente pode repetir um POST que recebeu 503/504. Uma fila com pending exigiria acompanhamento e processamento posterior. Se a resposta se perder depois da gravação, repetir o POST pode duplicar o anúncio.
- **Persistência.** Escolhemos Postgres com TypeORM pelas restrições de integridade e pela estrutura estável dos dados. SQLite reduziria o setup e um banco documental facilitaria atributos específicos por categoria. O Compose reproduz o ambiente. Uma tabela guarda URLs em JSONB, preço em centavos e uma restrição que relaciona status e motivo. A chamada externa ocorre antes da gravação, fora de transação.
- **Fronteiras.** O controller recebe HTTP, o pipe aplica Zod, o serviço coordena moderação e persistência. Zod aproveita experiência prévia do candidato e permite inferir o tipo da entrada. Cada falha da dependência estende BaseError e o filtro decide sua representação HTTP. O catálogo usa a decisão persistida.
- **Listagem e custo.** Offset com ordem por data e UUID facilita navegar por número de página. O total usa os mesmos filtros. Inserções entre consultas podem deslocar itens. Páginas profundas e a contagem ficam mais caras com volume. Uma evolução possível é medir planos de consulta e avaliar índice parcial para aprovados ou paginação por cursor. Nenhum benchmark foi realizado.
- **Testes.** Usamos o runner nativo do Node, fetch e Postgres isolado em vez de Jest/Supertest. O teste atravessa HTTP real e o banco, e o servidor externo controlado torna 429 e timeout reproduzíveis. O smoke usa o mock fornecido.
- **Compatibilidade do mock.** O documento externo descreve reason. Uma chamada HTTP real com preço de R$ 1 em esportes retornou 200 com {"status":"rejected","rejection_reason":"price_out_of_range"}. Aceitamos os dois formatos exclusivamente no cliente HTTP. O campo documentado tem preferência e a API pública sempre devolve rejectionReason. Uma reprovação sem motivo válido continua gerando 502.

## Retrospectiva

Tempo real aproximado do candidato e sua prioridade com mais tempo: aguardando relato. O orçamento de 4–6 horas é a expectativa do enunciado.

A verificação npm audit --omit=dev reportou três alertas moderados na cadeia TypeORM/glob/minimatch. A correção automática proposta troca a versão principal do ORM. Uma atualização deve repetir a suíte de persistência e o smoke.
