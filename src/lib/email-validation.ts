// Validação de e-mail única para hóspede, pagador e reserva manual.
// Mais rígida que o type="email" do navegador, que aceita "fulano@dominio" sem ponto.
const MAX_EMAIL_LENGTH = 254;
const LOCAL_PART = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const DOMAIN_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
const TOP_LEVEL_DOMAIN = /^[A-Za-z]{2,}$/;

export const INVALID_EMAIL_MESSAGE = 'Informe um e-mail válido, por exemplo nome@gmail.com.';

export function isValidEmail(value: unknown) {
    const email = String(value ?? '').trim();
    if (!email || email.length > MAX_EMAIL_LENGTH) return false;

    const at = email.lastIndexOf('@');
    if (at <= 0 || at !== email.indexOf('@')) return false;

    const local = email.slice(0, at);
    const domain = email.slice(at + 1);
    if (local.length > 64 || !LOCAL_PART.test(local)) return false;

    const labels = domain.split('.');
    if (labels.length < 2) return false;
    if (!labels.every((label) => DOMAIN_LABEL.test(label))) return false;
    return TOP_LEVEL_DOMAIN.test(labels[labels.length - 1]);
}
