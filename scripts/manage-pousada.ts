#!/usr/bin/env node
export {};
const { spawnSync } = require('child_process');
const path = require('path');
const r = spawnSync('npx', ['tsx', path.join(__dirname, 'reservas/db/manage-pousada.ts'), ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
