type OpsLogLevel = 'info' | 'warn' | 'error';

// O id completo da reserva dá acesso à página de confirmação; nos logs fica só o prefixo,
// suficiente para localizar a reserva no admin.
function redactBookingId(fields: Record<string, unknown>) {
    if (!('bookingId' in fields)) return fields;
    const { bookingId, ...rest } = fields;
    if (typeof bookingId !== 'string' || !bookingId) return rest;
    return { ...rest, bookingIdShort: rest.bookingIdShort ?? bookingId.slice(0, 8) };
}

export function opsLog(level: OpsLogLevel, event: string, fields?: Record<string, unknown>) {
    const payload = {
        ts: new Date().toISOString(),
        level,
        event,
        ...redactBookingId(fields || {}),
    };
    const line = JSON.stringify(payload);
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.info(line);
}
