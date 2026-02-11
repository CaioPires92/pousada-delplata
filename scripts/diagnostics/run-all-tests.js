const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 EXECUTANDO TODOS OS TESTES\n');
console.log('='.repeat(60));

const tests = [
    { name: 'Configuração', file: path.join(__dirname, 'run-tests.js') },
    { name: 'Database', file: path.join(__dirname, 'test-database.js') },
    { name: 'Mercado Pago', file: path.join(__dirname, 'test-mercadopago.js') }
];

let currentTest = 0;
let totalPassed = 0;
let totalFailed = 0;

function runNextTest() {
    if (currentTest >= tests.length) {
        console.log('\n' + '='.repeat(60));
        console.log('📊 RESUMO GERAL DE TODOS OS TESTES\n');
        console.log(`Suites executadas: ${tests.length}`);
        console.log(`Status: ${totalFailed === 0 ? '✅ SUCESSO' : '❌ FALHAS ENCONTRADAS'}`);
        console.log('='.repeat(60));
        console.log('\n📄 Relatório completo em: docs/root-legacy/PLANO_QA_TESTES.md\n');
        process.exit(totalFailed > 0 ? 1 : 0);
        return;
    }

    const test = tests[currentTest];
    console.log(`\n🔍 Executando: ${test.name}\n`);

    const child = spawn('node', [test.file], {
        stdio: 'inherit',
        shell: true
    });

    child.on('exit', (code) => {
        if (code === 0) {
            totalPassed++;
            console.log(`\n✅ ${test.name}: PASSOU\n`);
        } else {
            totalFailed++;
            console.log(`\n❌ ${test.name}: FALHOU\n`);
        }

        currentTest++;
        runNextTest();
    });

    child.on('error', (error) => {
        console.error(`\n❌ Erro ao executar ${test.name}:`, error);
        totalFailed++;
        currentTest++;
        runNextTest();
    });
}

runNextTest();