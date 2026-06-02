#!/usr/bin/env node
require('child_process').fork(require('path').join(__dirname, 'reservas/db/check-hospedin-migration-readiness.js'), process.argv.slice(2), { stdio: 'inherit' });
