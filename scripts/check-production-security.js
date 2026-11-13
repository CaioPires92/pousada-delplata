function findProductionSecurityErrors(env) {
  if (env.VERCEL_ENV !== 'production') return [];
  const errors = [];
  if (String(env.ENABLE_TEST_PAYMENTS).toLowerCase() !== 'false') {
    errors.push('ENABLE_TEST_PAYMENTS deve estar explicitamente definido como false em produção.');
  }
  if (String(env.NEXT_PUBLIC_ENABLE_TEST_PAYMENTS).toLowerCase() === 'true') {
    errors.push('NEXT_PUBLIC_ENABLE_TEST_PAYMENTS não pode estar habilitado em produção.');
  }
  // MP_* continuam obrigatórios: o webhook do Mercado Pago ainda recebe estornos/chargebacks antigos.
  for (const name of ['ASAAS_API_KEY', 'ASAAS_WEBHOOK_TOKEN', 'MP_ACCESS_TOKEN', 'MP_WEBHOOK_SECRET', 'ADMIN_JWT_SECRET', 'BOOKING_ACCESS_SECRET']) {
    if (!String(env[name] || '').trim()) errors.push(`${name} é obrigatório em produção.`);
  }
  if (String(env.ASAAS_ENVIRONMENT || '').trim().toLowerCase() !== 'production') {
    errors.push('ASAAS_ENVIRONMENT deve ser "production" em produção (senão os pagamentos vão para o sandbox).');
  }
  if (String(env.ASAAS_WEBHOOK_TOKEN || '').trim() && String(env.ASAAS_WEBHOOK_TOKEN).trim().length < 32) {
    errors.push('ASAAS_WEBHOOK_TOKEN deve ter pelo menos 32 caracteres.');
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
