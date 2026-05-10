type SendTextParams = {
    number: string;
    text: string;
};

export async function sendEvolutionText({ number, text }: SendTextParams) {
    const apiUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;
    const instanceName = process.env.EVOLUTION_INSTANCE_NAME;

    if (!apiUrl || !apiKey || !instanceName) {
        throw new Error("Evolution API env vars missing");
    }

    const cleanNumber = number.replace(/\D/g, "");

    const response = await fetch(
        `${apiUrl}/message/sendText/${instanceName}`,
        {
            method: "POST",
            headers: {
                apikey: apiKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                number: cleanNumber,
                text,
            }),
        }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        console.error("Evolution sendText error details:", JSON.stringify(data, null, 2));
        throw new Error("Failed to send WhatsApp message");
    }

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