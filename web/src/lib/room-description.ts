export function getRoomDisplayDescription(roomName: string, description: string | null | undefined) {
    let text = (description ?? '').trim();

    if (roomName === 'Apartamento Superior') {
        text = text.replace(/\s+e\s+vista privilegiada\b\.?/i, '.');
        text = text.replace(/\bvista privilegiada\b\.?/i, '');
    }

    if (roomName === 'Apartamento Térreo') {
        if (/^acessibilidade\s*e\s*/i.test(text)) {
            text = text.replace(/^acessibilidade\s*e\s*/i, '');
            text = text.charAt(0).toUpperCase() + text.slice(1);
        }

        text = text.replace(/\bacessibilidade\b\.?\s*/gi, '');
    }

    if (roomName === 'Apartamento Anexo' || roomName === 'Chalé') {
        const hasCafe = /café da manhã a 70 metros/i.test(text);
        const hasVentilador = /ventilador de teto/i.test(text);

        if (!hasCafe || !hasVentilador) {
            const suffix = !hasCafe && !hasVentilador
                ? 'Café da manhã a 70 metros e ventilador de teto.'
                : (!hasCafe ? 'Café da manhã a 70 metros.' : 'Ventilador de teto.');

            if (text && !/[.!?]$/.test(text)) text += '.';
            text = `${text} ${suffix}`.trim();
        }
    }

    text = text.replace(/\s{2,}/g, ' ').replace(/\s+\./g, '.').trim();
    return text;
}
