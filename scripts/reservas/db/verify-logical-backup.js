const fs = require('fs');
const path = require('path');

const inputArg = process.argv.find((item) => item.startsWith('--input='));
if (!inputArg) throw new Error('Informe --input=/caminho/backup.sql');
const input = path.resolve(inputArg.slice('--input='.length));
const stat = fs.statSync(input);
if (!stat.isFile() || stat.size === 0) throw new Error('Backup vazio ou inválido.');
const sql = fs.readFileSync(input, 'utf8');
for (const marker of ['BEGIN TRANSACTION;', 'CREATE TABLE', 'COMMIT;', 'PRAGMA foreign_keys=ON;']) {
  if (!sql.includes(marker)) throw new Error(`Backup incompleto: marcador ausente (${marker})`);
}
console.log(JSON.stringify({ input, bytes: stat.size, verified: true }, null, 2));
