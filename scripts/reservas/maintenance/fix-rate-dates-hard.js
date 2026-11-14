// SCRIPT DESATIVADO (T1b).
// Corrigia datas de Rate com UPDATEs em massa, sem dry-run, sem confirmação e sem checagem de destino.
// Não havia consumidores (package.json, CI, docs). O código original está no histórico do Git.
// Para reativar: reescreva com o guard compartilhado (scripts/shared/db-safety.js): dry-run + plano,
// --confirm=YES, e --allow-remote/--confirm-host para banco remoto.
console.error('Script desativado: correção de datas de tarifas sem proteções. Veja o comentário no topo do arquivo.');
process.exit(1);
