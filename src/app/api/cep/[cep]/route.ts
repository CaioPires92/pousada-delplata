import { NextResponse } from 'next/server';

import { onlyDigits } from '@/lib/billing-address';
import { consumeRequestLimit } from '@/lib/request-guard';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ cep: string }> };

/** Consulta de CEP (ViaCEP) feita no servidor, para preencher rua/bairro/cidade no formulário de reserva. */
export async function GET(request: Request, { params }: RouteContext) {
    const { cep } = await params;
    const postalCode = onlyDigits(cep);
    if (postalCode.length !== 8) {
        return NextResponse.json({ error: 'INVALID_POSTAL_CODE' }, { status: 400 });
    }

    const limit = consumeRequestLimit({ request, scope: 'cep-lookup', limit: 30, windowMs: 60_000 });
    if (!limit.allowed) {
        return NextResponse.json({ error: 'TOO_MANY_REQUESTS' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    try {
        const response = await fetch(`https://viacep.com.br/ws/${postalCode}/json/`, {
            signal: controller.signal,
            headers: { Accept: 'application/json' },
        });
        if (!response.ok) return NextResponse.json({ error: 'LOOKUP_UNAVAILABLE' }, { status: 502 });

        const data = await response.json().catch(() => null);
        if (!data || data.erro) return NextResponse.json({ error: 'POSTAL_CODE_NOT_FOUND' }, { status: 404 });

        return NextResponse.json({
            postalCode,
            address: String(data.logradouro || ''),
            province: String(data.bairro || ''),
            city: String(data.localidade || ''),
            state: String(data.uf || ''),
        });
    } catch {
        return NextResponse.json({ error: 'LOOKUP_UNAVAILABLE' }, { status: 502 });
    } finally {
        clearTimeout(timeoutId);
    }
}
