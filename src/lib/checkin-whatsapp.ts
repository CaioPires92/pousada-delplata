/**
 * Mensagem e link do WhatsApp para enviar o check-in online (Hospedin) ao hóspede.
 * Funções puras, sem acesso a rede, usadas pela página /admin/checkin-online.
 */

const CALLING_CODES: Record<string, string> = {
  BR: '55',
  AR: '54',
  UY: '598',
  PY: '595',
  CL: '56',
  PT: '351',
  US: '1',
};

export const DEFAULT_CHECKIN_MESSAGE = [
  'Olá, {nome}! Aqui é da Pousada Delplata.',
  'Sua hospedagem começa em {checkin}.',
  'Para agilizar sua chegada, faça o check-in online pelo link abaixo (leva poucos minutos):',
  '{link}',
].join('\n');

/**
 * Devolve só os dígitos com o código do país (ex.: 5519999654866), ou null se o número não servir.
 * `ddi` é a sigla ISO do país como o Hospedin devolve ("BR"); vazio vale Brasil.
 */
export function normalizeGuestPhone(phone: unknown, ddi?: unknown): string | null {
  let digits = String(phone ?? '').replace(/\D/g, '');
  if (!digits) return null;

  const country = String(ddi ?? '').trim().toUpperCase() || 'BR';
  const code = CALLING_CODES[country];
  if (!code) return null;

  digits = digits.replace(/^0+/, '');
  if (digits.startsWith(code) && (code !== '55' || digits.length >= 12)) {
    // Já vem com o código do país.
  } else {
    digits = `${code}${digits}`;
  }

  if (code === '55') {
    // 55 + DDD (2) + 8 ou 9 dígitos.
    if (digits.length < 12 || digits.length > 13) return null;
  } else if (digits.length < 9 || digits.length > 15) {
    return null;
  }
  return digits;
}

/** "2026-11-27T14:00:00-03:00" ou "2026-11-27" → "27/11". */
export function formatCheckinDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return `${match[3]}/${match[2]}`;
}

export function firstName(name: string): string {
  const cleaned = name.replace(/^SITE\s*-\s*/i, '').trim();
  const first = cleaned.split(/\s+/)[0] || '';
  if (!first) return 'hóspede';
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export function fillCheckinMessage(
  template: string,
  values: { nome: string; checkin: string; link: string },
): string {
  const message = template
    .replaceAll('{nome}', firstName(values.nome))
    .replaceAll('{checkin}', formatCheckinDate(values.checkin))
    .replaceAll('{link}', values.link);
  return message.trim();
}

export function buildCheckinWhatsAppUrl(phoneDigits: string, message: string): string {
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
}
