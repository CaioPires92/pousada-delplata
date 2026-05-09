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
        console.error("Evolution sendText error:", data);
        throw new Error("Failed to send WhatsApp message");
    }

    return data;
}