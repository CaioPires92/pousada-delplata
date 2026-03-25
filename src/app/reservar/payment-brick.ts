export type PaymentBrickInitializationPayer = {
    email?: string;
};

export type PaymentSubmissionPayer = {
    email?: string;
    first_name?: string;
    last_name?: string;
    identification?: {
        type: string;
        number: string;
    };
    entity_type?: 'individual' | 'association';
};

function getGuestNameParts(rawName: string) {
    const normalizedName = String(rawName || '').trim().replace(/\s+/g, ' ');
    const nameParts = normalizedName.length > 0 ? normalizedName.split(' ').filter(Boolean) : [];
    const firstName = nameParts[0] || undefined;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined;

    return {
        firstName,
        lastName,
    };
}

function normalizeEntityType(value: unknown): PaymentSubmissionPayer['entity_type'] | undefined {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'individual' || normalized === 'association') return normalized;
    return undefined;
}

export function buildPaymentBrickInitializationPayer(email: string): PaymentBrickInitializationPayer {
    const normalizedEmail = String(email || '').trim();
    return {
        email: normalizedEmail || undefined,
    };
}

export function normalizePaymentBrickPayer(params: {
    payerFromBrick?: Record<string, any> | null;
    guestName: string;
    guestEmail: string;
}): PaymentSubmissionPayer {
    const payerFromBrick = params.payerFromBrick ?? {};
    const { firstName, lastName } = getGuestNameParts(params.guestName);
    const identificationType = String(payerFromBrick?.identification?.type || '').trim();
    const identificationNumber = String(payerFromBrick?.identification?.number || '').trim();
    const entityType = normalizeEntityType(payerFromBrick?.entity_type ?? payerFromBrick?.entityType);
    const normalizedEmail = String(payerFromBrick?.email || params.guestEmail || '').trim();

    return {
        email: normalizedEmail || undefined,
        first_name: String(payerFromBrick?.first_name || payerFromBrick?.firstName || firstName || '').trim() || undefined,
        last_name: String(payerFromBrick?.last_name || payerFromBrick?.lastName || lastName || '').trim() || undefined,
        identification: identificationType && identificationNumber
            ? {
                type: identificationType,
                number: identificationNumber,
            }
            : undefined,
        entity_type: entityType,
    };
}
