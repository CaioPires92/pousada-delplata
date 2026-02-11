import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { opsLog } from '@/lib/ops-log';
import { sendContactEmail } from '@/lib/email';

export const runtime = 'nodejs';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const name = typeof body?.name === 'string' ? body.name.trim() : '';
        const email = typeof body?.email === 'string' ? body.email.trim() : '';
        const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
        const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
        const message = typeof body?.message === 'string' ? body.message.trim() : '';

        if (!name || !email || !phone || !message) {
            opsLog('warn', 'CONTACT_SEND_INVALID', { name, email, phone, subject });
            return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
        }

        const result = await sendContactEmail({ name, email, phone, subject, message });
        if (!result.success) {
            opsLog('error', 'CONTACT_SEND_ERROR', { subject, email });
            return NextResponse.json({ error: 'Falha ao enviar' }, { status: 500 });
        }

        opsLog('info', 'CONTACT_SEND_SUCCESS', { subject, email });
        return NextResponse.json({ success: true });
    } catch (error) {
        Sentry.captureException(error);
        opsLog('error', 'CONTACT_SEND_EXCEPTION');
        return NextResponse.json({ error: 'Erro ao processar' }, { status: 500 });
    }
}
