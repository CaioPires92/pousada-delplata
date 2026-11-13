import { NextResponse } from 'next/server';
import { opsLog } from '@/lib/ops-log';
import { normalizeSingleEmailAddress, sendContactEmail } from '@/lib/email';
import { consumeRequestLimit, isHoneypotFilled, readJsonBody, RequestGuardError } from '@/lib/request-guard';

export const runtime = 'nodejs';

export async function POST(request: Request) {
    try {
        const body = await readJsonBody<any>(request, 16 * 1024);
        if (isHoneypotFilled(body)) return NextResponse.json({ success: true });
        const name = typeof body?.name === 'string' ? body.name.trim() : '';
        const email = normalizeSingleEmailAddress(body?.email) || '';
        const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
        const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
        const message = typeof body?.message === 'string' ? body.message.trim() : '';

        const rateLimit = consumeRequestLimit({
            request, scope: 'contact', discriminator: email.toLowerCase(), limit: 5, windowMs: 15 * 60_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, {
                status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
            });
        }

        if (!name || !email || !phone || !message) {
            opsLog('warn', 'CONTACT_SEND_INVALID');
            return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
        }

        const result = await sendContactEmail({ name, email, phone, subject, message });
        if (!result.success) {
            opsLog('error', 'CONTACT_SEND_ERROR');
            return NextResponse.json({ error: 'Falha ao enviar' }, { status: 500 });
        }

        opsLog('info', 'CONTACT_SEND_SUCCESS');
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof RequestGuardError) {
            return NextResponse.json({ error: error.code }, { status: error.status });
        }
        opsLog('error', 'CONTACT_SEND_EXCEPTION');
        return NextResponse.json({ error: 'Erro ao processar' }, { status: 500 });
    }
}
