#!/usr/bin/env node
require('child_process').fork(require('path').join(__dirname, 'reservas/db/seed-hospedin-ids.js'), process.argv.slice(2), { stdio: 'inherit' });
