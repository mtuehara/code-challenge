# Anúncios — estado

- Revisão: 1, 2026-11-23.
- Fluxo: SDD completo, proporcional ao desafio; etapa de especificação e design para revisão.
- Revisão inicial em conversa concluída para três decisões. O usuário confirmou com “sshow, concordo”, após receber as justificativas: listar apenas aprovados; moderação síncrona sem salvar em falha técnica; salvar reprovados com motivo e retornar 201.
- Stack confirmada: NestJS, TypeScript, Postgres e TypeORM. Durante o desenvolvimento, NestJS roda localmente e o Compose sobe banco e mock. Para a entrega, o Compose inclui a API.
- Zod confirmado para validar entradas HTTP. O usuário aprovou a hierarquia BaseError para falhas da moderação e sua tradução HTTP por um filtro NestJS. As classes entram na T-005, guiadas pelos testes. O prazo exato de timeout e as regras adicionais de validação e paginação continuam propostos em requirements.md.
- Nenhuma implementação iniciada ou teste executado. Não há commit de referência: inspeção anterior com git status --short informou que o diretório não é repositório Git.
- Inspeção atual encontrou README.md e backend; nenhuma especificação preexistente foi encontrada. Nenhum AGENTS.md foi encontrado na busca do workspace ou nos caminhos ancestrais consultados.
- Próxima ação: revisar propostas restantes em conjunto, depois iniciar T-001/T-002. Não voltar a pedir aprovação das três decisões já confirmadas.
- A documentação de execução na raiz permanece original até haver comandos da aplicação validados. DECISIONS.md e AI_USAGE.md serão produzidos durante o trabalho com base nos registros reais.
