#!/usr/bin/env node
require('child_process').fork(require('path').join(__dirname, '../reservas/diagnostics/test-responsiveness.js'), process.argv.slice(2), { stdio: 'inherit' });
