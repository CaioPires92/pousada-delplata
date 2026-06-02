#!/usr/bin/env node
require('child_process').fork(require('path').join(__dirname, 'reservas/media/update-photo-urls.mjs'), process.argv.slice(2), { stdio: 'inherit' });
