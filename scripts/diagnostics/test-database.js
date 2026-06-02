#!/usr/bin/env node
require('child_process').fork(require('path').join(__dirname, '../reservas/diagnostics/test-database.js'), process.argv.slice(2), { stdio: 'inherit' });
