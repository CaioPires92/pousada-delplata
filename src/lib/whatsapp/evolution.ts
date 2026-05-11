type SendTextParams = {
    number: string;
    text: string;
};

type ContactSendTarget = {
    phone?: string | null;
    phoneRaw?: string | null;
    whatsappJid?: string | null;
};

export function resolveEvolutionSendTarget(contact: ContactSendTarget, fallback?: string | null) {
    const jid = contact.whatsappJid?.trim();
    const fallbackTarget = fallback?.trim();
    const phone = contact.phone?.trim();
    const phoneRaw = contact.phoneRaw?.trim();

    if (jid?.includes("@lid")) return jid;
    if (fallbackTarget?.includes("@lid")) return fallbackTarget;
    if (jid) return jid;
    if (fallbackTarget?.includes("@")) return fallbackTarget;
    return phone || phoneRaw || fallbackTarget || null;
}

export async function sendEvolutionText({ number, text }: SendTextParams) {
    const apiUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;
    const instanceName = process.env.EVOLUTION_INSTANCE_NAME;

    if (!apiUrl || !apiKey || !instanceName) {
        throw new Error("Evolution API env vars missing");
    }

    // Garantimos que o destino seja um JID válido para a Evolution
    let target = number;
    if (!target.includes("@")) {
        // Se for só número, limpamos e adicionamos o sufixo padrão
        target = target.replace(/\D/g, "") + "@s.whatsapp.net";
    }

    console.log(`--- [EVOLUTION] FORÇANDO ENVIO PARA JID: ${target} ---`);

    const response = await fetch(
        `${apiUrl}/message/sendText/${instanceName}`,
        {
            method: "POST",
            headers: {
                apikey: apiKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                number: target,
                text,
            }),
        }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        console.error("--- [EVOLUTION] ERRO NO ENVIO ---", JSON.stringify(data, null, 2));
        throw new Error("Failed to send WhatsApp message");
    }

    console.log("--- [EVOLUTION] MENSAGEM ENVIADA COM SUCESSO ---", data?.key?.id);
    return data;
}

export async function fetchEvolutionContact(jid: string) {
    const apiUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;
    const instanceName = process.env.EVOLUTION_INSTANCE_NAME;

    if (!apiUrl || !apiKey || !instanceName) {
        throw new Error("Evolution API env vars missing");
    }

    // Estratégia de Busca Exaustiva
    const endpoints = [
        { url: `${apiUrl}/chat/getContact/${instanceName}?number=${jid}`, method: 'GET' },
        { url: `${apiUrl}/chat/fetchProfile/${instanceName}?number=${jid}`, method: 'GET' },
        { url: `${apiUrl}/chat/findContacts/${instanceName}`, method: 'POST', body: { where: { remoteJid: jid } } }
    ];

    for (const ep of endpoints) {
        try {
            const options: RequestInit = {
                method: ep.method,
                headers: {
                    apikey: apiKey,
                    "Content-Type": "application/json",
                },
            };
            if (ep.body) options.body = JSON.stringify(ep.body);

            const response = await fetch(ep.url, options);
            const data = await response.json().catch(() => null);
            const contact = Array.isArray(data) ? data[0] : data;

            if (contact) {
                // Procuramos o JID real em QUALQUER campo
                const candidateFields = [contact.id, contact.remoteJid, contact.jid, contact.number, contact.pushName];
                const realJid = candidateFields.find(f => typeof f === 'string' && f.includes('@s.whatsapp.net'));

                if (realJid) {
                    return { ...contact, resolvedJid: realJid };
                }
            }
        } catch (err) {
            console.error(`Erro no endpoint ${ep.url}:`, err);
        }
    }

    return null;
}
