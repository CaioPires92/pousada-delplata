type OpsLogLevel = 'info' | 'warn' | 'error';

export function opsLog(level: OpsLogLevel, event: string, fields?: Record<string, unknown>) {
    const payload = {
        ts: new Date().toISOString(),
        level,
        event,
        ...(fields || {}),
    };
    const line = JSON.stringify(payload);
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.info(line);
}

