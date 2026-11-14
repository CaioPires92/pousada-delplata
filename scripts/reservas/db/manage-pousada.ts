import { runCli } from './manage-pousada-cli';

// Entrada fina: toda a lógica e as proteções estão em manage-pousada-cli.ts / manage-pousada-guard.ts.
// O Prisma só é importado (e portanto só conecta) depois que as proteções passam.
runCli(
    process.argv.slice(2),
    process.env,
    async () => (await import('../../../src/lib/prisma')).default,
    { log: (line) => console.log(line), error: (line) => console.error(line) }
).then(
    (code) => process.exit(code),
    () => {
        console.error('erro: falha inesperada');
        process.exit(5);
    }
);
