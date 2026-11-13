function findProductionSecurityErrors(env) {
  if (env.VERCEL_ENV !== 'production') return [];
  const errors = [];
  if (String(env.ENABLE_TEST_PAYMENTS).toLowerCase() !== 'false') {
    errors.push('ENABLE_TEST_PAYMENTS deve estar explicitamente definido como false em produção.');
  }
  if (String(env.NEXT_PUBLIC_ENABLE_TEST_PAYMENTS).toLowerCase() === 'true') {
    errors.push('NEXT_PUBLIC_ENABLE_TEST_PAYMENTS não pode estar habilitado em produção.');
  }
  for (const name of ['MP_ACCESS_TOKEN', 'MP_WEBHOOK_SECRET', 'ADMIN_JWT_SECRET', 'BOOKING_ACCESS_SECRET']) {
    if (!String(env[name] || '').trim()) errors.push(`${name} é obrigatório em produção.`);
  }
  return errors;
}

if (require.main === module) {
  const errors = findProductionSecurityErrors(process.env);
  if (errors.length) {
    console.error(`Verificação de segurança falhou:\n- ${errors.join('\n- ')}`);
    process.exit(1);
  }
  console.log('Verificação de segurança do ambiente concluída.');
}

module.exports = { findProductionSecurityErrors };
