const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

console.log('📱 TESTES DE RESPONSIVIDADE AUTOMATIZADOS\n');
console.log('='.repeat(60));

// Criar diretório para screenshots
const screenshotsDir = path.join(__dirname, 'screenshots', 'responsividade');
if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
}

const devices = [
    { name: 'Mobile_320', width: 320, height: 568 },
    { name: 'Mobile_375', width: 375, height: 667 },
    { name: 'Mobile_414', width: 414, height: 896 },
    { name: 'Tablet_768', width: 768, height: 1024 },
    { name: 'Tablet_1024', width: 1024, height: 768 },
    { name: 'Desktop_1280', width: 1280, height: 720 },
    { name: 'Desktop_1440', width: 1440, height: 900 },
    { name: 'Desktop_1920', width: 1920, height: 1080 }
];

const pages = [
    { name: 'Homepage', url: 'http://localhost:3001' },
    { name: 'Reservar', url: 'http://localhost:3001/reservar?checkIn=2025-12-01&checkOut=2025-12-02' },
    { name: 'Admin_Login', url: 'http://localhost:3001/admin/login' },
    { name: 'Admin_Dashboard', url: 'http://localhost:3001/admin/dashboard' }
];

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

async function testResponsiveness() {
    console.log('\n🚀 Iniciando testes...\n');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    for (const page of pages) {
        console.log(`\n📄 Testando: ${page.name}\n`);

        for (const device of devices) {
            testsRun++;
            const testName = `${page.name} - ${device.name}`;

            try {
                const browserPage = await browser.newPage();

                // Configurar viewport
                await browserPage.setViewport({
                    width: device.width,
                    height: device.height,
                    deviceScaleFactor: 1
                });

                // Navegar para a página
                await browserPage.goto(page.url, {
                    waitUntil: 'networkidle2',
                    timeout: 10000
                });

                // Aguardar um pouco para garantir que tudo carregou
                await browserPage.waitForTimeout(1000);

                // Capturar screenshot
                const screenshotPath = path.join(
                    screenshotsDir,
                    `${page.name}_${device.name}.png`
                );
                await browserPage.screenshot({
                    path: screenshotPath,
                    fullPage: true
                });

                // Verificar se há scroll horizontal
                const hasHorizontalScroll = await browserPage.evaluate(() => {
                    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
                });

                // Verificar se há erros no console
                const errors = [];
                browserPage.on('console', msg => {
                    if (msg.type() === 'error') {
                        errors.push(msg.text());
                    }
                });

                await browserPage.close();

                // Validar resultados
                if (hasHorizontalScroll) {
                    throw new Error('Scroll horizontal detectado');
                }

                testsPassed++;
                console.log(`✅ ${testName}`);

            } catch (error) {
                testsFailed++;
                console.log(`❌ ${testName}: ${error.message}`);
            }
        }
    }

    await browser.close();

    // Resumo
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO DOS TESTES DE RESPONSIVIDADE\n');
    console.log(`Total de testes: ${testsRun}`);
    console.log(`✅ Passou: ${testsPassed} (${Math.round(testsPassed / testsRun * 100)}%)`);
    console.log(`❌ Falhou: ${testsFailed} (${Math.round(testsFailed / testsRun * 100)}%)`);
    console.log(`\n📸 Screenshots salvos em: ${screenshotsDir}`);
    console.log('='.repeat(60));

    if (testsFailed === 0) {
        console.log('\n🎉 TODOS OS TESTES PASSARAM!\n');
    } else {
        console.log('\n⚠️  ALGUNS TESTES FALHARAM\n');
    }

    process.exit(testsFailed > 0 ? 1 : 0);
}

// Verificar se o servidor está rodando
console.log('⏳ Verificando se o servidor está rodando...\n');

const http = require('http');
http.get('http://localhost:3001', (res) => {
    if (res.statusCode === 200) {
        console.log('✅ Servidor rodando!\n');
        testResponsiveness().catch(error => {
            console.error('\n❌ Erro fatal:', error);
            process.exit(1);
        });
    }
}).on('error', () => {
    console.error('❌ Servidor não está rodando!');
    console.log('\n💡 Execute: npm run dev\n');
    process.exit(1);
});
