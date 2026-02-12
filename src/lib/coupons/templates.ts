export type CouponTemplateId =
    | 'PRIVATE_1TO1'
    | 'CAMPAIGN_CONTROLLED'
    | 'PARTNER_CHANNEL'
    | 'REACTIVATION';

export type CouponTemplatePayload = {
    name: string;
    type: 'PERCENT' | 'FIXED';
    value: number;
    generateCode: boolean;
    maxDiscountAmount: number | null;
    minBookingValue: number | null;
    startsAt: string | null;
    endsAt: string | null;
    maxGlobalUses: number | null;
    maxUsesPerGuest: number | null;
    bindEmail: string | null;
    bindPhone: string | null;
    allowedSources: string[];
    allowedRoomTypeIds: string[];
    singleUse: boolean;
    stackable: boolean;
    active: boolean;
};

export type CouponTemplate = {
    id: CouponTemplateId;
    name: string;
    description: string;
    antifraudLevel: 'HIGH' | 'MEDIUM';
    payload: CouponTemplatePayload;
};

function nowPlusHours(hours: number) {
    return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function nowPlusDays(days: number) {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function getCouponTemplates(): CouponTemplate[] {
    return [
        {
            id: 'PRIVATE_1TO1',
            name: 'Privado 1:1',
            description: 'Cupom individual, uso unico e validade curta para envio direto ao hospede.',
            antifraudLevel: 'HIGH',
            payload: {
                name: 'Privado 1:1',
                type: 'PERCENT',
                value: 10,
                generateCode: true,
                maxDiscountAmount: null,
                minBookingValue: null,
                startsAt: new Date().toISOString(),
                endsAt: nowPlusHours(72),
                maxGlobalUses: 1,
                maxUsesPerGuest: 1,
                bindEmail: null,
                bindPhone: null,
                allowedSources: ['direct'],
                allowedRoomTypeIds: [],
                singleUse: true,
                stackable: false,
                active: true,
            },
        },
        {
            id: 'CAMPAIGN_CONTROLLED',
            name: 'Campanha controlada',
            description: 'Campanha aberta com limite global e por hospede, para evitar abuso em massa.',
            antifraudLevel: 'MEDIUM',
            payload: {
                name: 'Campanha controlada',
                type: 'PERCENT',
                value: 15,
                generateCode: true,
                maxDiscountAmount: 180,
                minBookingValue: 300,
                startsAt: new Date().toISOString(),
                endsAt: nowPlusDays(14),
                maxGlobalUses: 120,
                maxUsesPerGuest: 1,
                bindEmail: null,
                bindPhone: null,
                allowedSources: ['direct', 'instagram'],
                allowedRoomTypeIds: [],
                singleUse: false,
                stackable: false,
                active: true,
            },
        },
        {
            id: 'PARTNER_CHANNEL',
            name: 'Parceiro/canal',
            description: 'Cupom para parceiros, limitado por canal permitido.',
            antifraudLevel: 'MEDIUM',
            payload: {
                name: 'Parceiro canal',
                type: 'FIXED',
                value: 80,
                generateCode: true,
                maxDiscountAmount: 80,
                minBookingValue: 350,
                startsAt: new Date().toISOString(),
                endsAt: nowPlusDays(30),
                maxGlobalUses: 200,
                maxUsesPerGuest: 1,
                bindEmail: null,
                bindPhone: null,
                allowedSources: ['partner'],
                allowedRoomTypeIds: [],
                singleUse: false,
                stackable: false,
                active: true,
            },
        },
        {
            id: 'REACTIVATION',
            name: 'Reativacao',
            description: 'Recuperacao de hospede inativo com desconto forte e validade curta.',
            antifraudLevel: 'HIGH',
            payload: {
                name: 'Reativacao',
                type: 'PERCENT',
                value: 20,
                generateCode: true,
                maxDiscountAmount: 250,
                minBookingValue: 450,
                startsAt: new Date().toISOString(),
                endsAt: nowPlusDays(10),
                maxGlobalUses: null,
                maxUsesPerGuest: 1,
                bindEmail: null,
                bindPhone: null,
                allowedSources: ['direct', 'email'],
                allowedRoomTypeIds: [],
                singleUse: true,
                stackable: false,
                active: true,
            },
        },
    ];
}
