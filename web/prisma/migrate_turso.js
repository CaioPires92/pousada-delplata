const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env' });

const url = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;

if (!url || !authToken) {
    console.error('Missing DATABASE_URL or DATABASE_AUTH_TOKEN');
    process.exit(1);
}

const client = createClient({
    url,
    authToken,
});

async function migrate() {
    console.log('Migrating database...');
    
    const queries = [
        'ALTER TABLE Rate ADD COLUMN cta BOOLEAN DEFAULT 0',
        'ALTER TABLE Rate ADD COLUMN ctd BOOLEAN DEFAULT 0',
        'ALTER TABLE Rate ADD COLUMN stopSell BOOLEAN DEFAULT 0',
        'ALTER TABLE Rate ADD COLUMN minLos INTEGER DEFAULT 1',
    ];

    for (const query of queries) {
        try {
            await client.execute(query);
            console.log(`Executed: ${query}`);
        } catch (e) {
            if (e.message.includes('duplicate column name')) {
                console.log(`Skipped (already exists): ${query}`);
            } else {
                console.error(`Error executing ${query}:`, e);
            }
        }
    }
    
    console.log('Migration complete.');
}

migrate();
