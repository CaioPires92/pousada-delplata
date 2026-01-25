Para alcançar uma cobertura de testes abrangente (rumo aos 100%), precisaremos configurar um ambiente de testes do zero, já que o projeto atualmente não possui um framework de testes configurado (apenas scripts isolados).

Recomendo o uso do **Vitest** com **React Testing Library**, pois é mais rápido e moderno, integrando-se perfeitamente com Next.js e TypeScript.

### Plano de Implementação

1.  **Configuração do Ambiente de Testes**:
    -   Instalar dependências: `vitest`, `@testing-library/react`, `@vitejs/plugin-react`, `jsdom`.
    -   Criar arquivo de configuração `vitest.config.ts` para suportar TypeScript e alias de caminhos (`@/`).
    -   Adicionar script `test` e `test:coverage` no `package.json`.

2.  **Testes de Unidade (Lógica de Negócio e APIs)**:
    -   Focar na lógica crítica de **Preços e Disponibilidade** (onde ocorreram os bugs recentes).
    -   Testar as rotas de API (`/api/availability`, `/api/admin/calendar`) isolando a lógica de banco de dados (mock do Prisma).
    -   Validar as correções de fuso horário e cálculo de tarifas.

3.  **Testes de Componentes (Frontend)**:
    -   Criar testes para o componente de reserva (`ReservarContent`), simulando interações do usuário e respostas da API.
    -   Validar se as datas e preços são exibidos corretamente na interface.

4.  **Execução e Relatório**:
    -   Rodar a suíte de testes e gerar o relatório de cobertura.

Vou começar instalando as ferramentas necessárias e configurando o Vitest. Posso prosseguir?