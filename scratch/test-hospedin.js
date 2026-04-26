import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple env loader
function loadEnv(filePath) {
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        content.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
            }
        });
    }
}

loadEnv(path.resolve(__dirname, '../.env'));
loadEnv('z:/home/caio/projetos/Hospedin/.env');

const BASE_URL = process.env.BASE_URL || 'https://pms-api.hospedin.com/api/v2';
const EMAIL = process.env.HOSPEDIN_EMAIL;
const PASSWORD = process.env.HOSPEDIN_PASSWORD;
const ACCOUNT_ID = process.env.HOSPEDIN_ACCOUNT_ID;

async function main() {
    try {
        const loginRes = await fetch(`${BASE_URL}/authentication/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: EMAIL, password: PASSWORD })
        });

        const loginData = await loginRes.json();
        const token = loginData.token;

        const placeTypesRes = await fetch(`${BASE_URL}/${ACCOUNT_ID}/place_types`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const placeTypesData = await placeTypesRes.json();
        
        console.log('Hospedin Place Types:');
        placeTypesData.data.forEach(pt => {
            console.log(`- ${pt.title} (ID: ${pt.id})`);
        });

    } catch (error) {
        console.error('Error:', error.message);
    }
}

main();
