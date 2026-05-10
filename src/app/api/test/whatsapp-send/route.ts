import { NextResponse } from "next/server";
import { sendEvolutionText } from "@/lib/whatsapp/evolution";

export async function GET() {
    try {
        const result = await sendEvolutionText({
            number: "5519999999999", // seu número real de teste
            text: "Teste do CRM Delplata 🚀",
        });

        return NextResponse.json({
            ok: true,
            result,
        });
    } catch (error) {
        console.error("Erro ao enviar mensagem:", error);

        return NextResponse.json(
            { ok: false, error: "send_failed" },
            { status: 500 }
        );
    }
}