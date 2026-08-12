const DEFAULT_WEBHOOK_TRANSACTION_TIMEOUT_MS = 15_000;
const MIN_WEBHOOK_TRANSACTION_TIMEOUT_MS = 5_000;
const MAX_WEBHOOK_TRANSACTION_TIMEOUT_MS = 30_000;

export function webhookTransactionTimeoutMs(value = process.env.CRM_WEBHOOK_TRANSACTION_TIMEOUT_MS) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isInteger(parsed)) return DEFAULT_WEBHOOK_TRANSACTION_TIMEOUT_MS;
  return Math.max(MIN_WEBHOOK_TRANSACTION_TIMEOUT_MS, Math.min(MAX_WEBHOOK_TRANSACTION_TIMEOUT_MS, parsed));
}

export function webhookTransactionOptions(value = process.env.CRM_WEBHOOK_TRANSACTION_TIMEOUT_MS) {
  return {
    maxWait: 5_000,
    timeout: webhookTransactionTimeoutMs(value),
  };
}
