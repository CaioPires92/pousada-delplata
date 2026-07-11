#!/usr/bin/env node
require('child_process').fork(require('path').join(__dirname, 'reservas/db/inspect-rate-duplicates.js'), process.argv.slice(2), { stdio: 'inherit' });
