#!/usr/bin/env node
require('child_process').fork(require('path').join(__dirname, 'reservas/db/dedupe-rate-rows.js'), process.argv.slice(2), { stdio: 'inherit' });
