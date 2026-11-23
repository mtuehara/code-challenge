# Anúncios — requisitos

Revisão 1, em 2026-11-23. Planejamento; nenhuma implementação validada.

## Objetivo e fontes

API REST para criar, listar e detalhar anúncios, com persistência e moderação externa. Fontes: `../../README.md`, `../../backend/README.md` e `../../backend/api-mock/docs-candidato/API.md`, lidas nessa ordem. O contrato HTTP documentado é a fonte da integração; regras internas do mock não pertencem à aplicação.

Prazo de entrega: sete dias corridos a partir do recebimento; esforço esperado pelo enunciado: quatro a seis horas. A data de recebimento ainda não foi informada.

## Requisitos e aceitação

| ID | Comportamento e origem | Critério verificável |
| --- | --- | --- |
| R-001 | Receber título, descrição, preço, categoria e ao menos uma imagem. Explícito no backend. | POST com todos os campos válidos e moderação aprovada devolve anúncio com ID e os dados enviados. |
| R-002 | Título de 10 a 100 caracteres e preço maior que zero. Explícito no backend. | Títulos de 9/101 caracteres, preço zero/negativo e lista de imagens vazia recebem erro de validação sem chamar moderação nem persistir. Títulos de 10/100 passam pela validação. |
| R-003 | Persistir e consultar anúncio individual com dados e status. Explícito no backend. | Após criação e reinício da aplicação usando a mesma base, GET pelo ID mantém os dados e a decisão. ID inexistente retorna 404. |
| R-004 | Aprovação externa antes de publicação. Explícito no backend. | POST envia os quatro campos do contrato para a moderação. Somente resposta approved permite publicação. Faixas de preço e regras de conteúdo não são reimplementadas. |
| R-005 | Persistir reprovados com motivo; POST retorna 201 e detalhe permite consultá-los. Persistência/status/motivo exigidos pelo enunciado; contrato 201 confirmado pelo usuário. | Resposta externa rejected com reason gera anúncio consultável com os mesmos status e motivo. |
| R-006 | Listagem paginada com filtro por categoria. Explícito no backend. Apenas aprovados são listados, conforme decisão confirmada. | Misturar categorias e estados; consultar uma categoria retorna somente seus aprovados e exclui reprovados. |
| R-007 | Moderação síncrona; falha técnica não gera anúncio persistido nem publicado. Confirmado pelo usuário. | Timeout, 429 e indisponibilidade retornam erro ao cliente e não acrescentam registros na base/listagem. Não são tratados como rejected. |
| R-008 | Testes de comportamento e integração HTTP real. Solicitado pelo usuário. | Registrar vermelho esperado, verde e refatoração por fatia; comprovar ao menos uma aprovação e uma reprovação com o mock real. |
| R-009 | Documentação de execução, API, decisões e uso real de IA. Explícito no README e solicitado pelo usuário. | Seguir o README para iniciar e testar; confrontar exemplos com respostas; registrar tempo informado pelo usuário e discussão sobre evolução. |

## Fora do escopo proposto

Autenticação, edição/exclusão, upload de arquivos, fila, processamento pendente, retentativas automáticas e idempotência. Não alterar nem reproduzir regras internas do mock.

## Propostas ainda não confirmadas

- Timeout configurável, inicialmente 3 segundos. O valor exato continua em aberto. O mapeamento HTTP das falhas foi acordado e está em design.md.
- Filtrar aprovados e categoria antes de ordenar por createdAt DESC, id DESC e paginar por offset. page=1, pageSize=20, máximo 100. Total usa os mesmos filtros. Página além do fim retorna lista vazia; parâmetros inválidos retornam 400.
- Remover espaços externos do título; medir comprimento após normalização. Definir a convenção de contagem de caracteres antes dos testes de limite.
- Preço recebido em reais, no máximo duas casas decimais e armazenado em centavos.
- Imagens como URLs HTTP/HTTPS, descrição não vazia e categoria entre as seis documentadas. Não baixar imagens.

Limitação proposta: sem idempotência, repetir POST após perda da resposta pode criar duplicata. Sem snapshot entre páginas, novas inserções podem deslocar itens.
