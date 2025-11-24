# Configuração do Turso (LibSQL)

Este guia ajuda a obter e configurar as credenciais do Turso para seu projeto.

## 1. Pré-requisitos
Você precisa ter a [Turso CLI](https://docs.turso.tech/cli/introduction) instalada e estar logado (`turso auth login`).

## 2. Obter a URL do Banco de Dados

Execute o comando abaixo substituindo `NOME_DO_BANCO` pelo nome do seu banco (parece ser `pousada-delplata-caiopires92` baseado no seu .env anterior):

```bash
turso db show NOME_DO_BANCO
```

Copie o valor da **URL**. Deve começar com `libsql://`.

## 3. Obter o Token de Autenticação

Gere um novo token para garantir que você tem um válido:

```bash
turso db tokens create NOME_DO_BANCO
```

Copie o **Token** inteiro gerado.

## 4. Configurar o arquivo .env

Abra o arquivo `web/.env` e configure as variáveis. 
**IMPORTANTE**: Não deixe espaços antes ou depois do sinal de igual (`=`).

```properties
# Correto ✅
DATABASE_URL=libsql://seu-banco.turso.io
DATABASE_AUTH_TOKEN=eyJh...

# Incorreto ❌ (Não use espaços!)
DATABASE_URL = libsql://...
DATABASE_AUTH_TOKEN = eyJh...
```

## 5. Verificar Conexão

Após configurar, reinicie seu servidor de desenvolvimento:

```bash
npm run dev
```

Se tudo estiver correto, você verá no terminal:
`[Prisma] Initializing with TURSO/LIBSQL adapter`

## Solução de Problemas

### Erro: SQLITE_UNKNOWN
Se você ver este erro, significa que o sistema não conseguiu conectar no Turso e tentou usar um banco local vazio.
- Verifique se o `DATABASE_AUTH_TOKEN` está no `.env`.
- Verifique se não há espaços no `.env`.
- Gere um novo token com `turso db tokens create`.

### Erro: URL must start with the protocol `libsql:`
Certifique-se de que sua `DATABASE_URL` começa com `libsql://` e não `https://` ou `wss://` (embora `wss` geralmente funcione, `libsql` é o recomendado para o driver).
