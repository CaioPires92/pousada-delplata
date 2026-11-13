'use client';

import { MapPin } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { formatPostalCode, onlyDigits } from '@/lib/billing-address';

export type BillingForm = {
    postalCode: string;
    address: string;
    addressNumber: string;
    province: string;
    complement: string;
    /** Só para exibição (vem do CEP); não é enviado ao Asaas. */
    city: string;
    state: string;
};

export const emptyBillingForm: BillingForm = {
    postalCode: '',
    address: '',
    addressNumber: '',
    province: '',
    complement: '',
    city: '',
    state: '',
};

const inputClass =
    'flex h-10 w-full rounded-none border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

type LookupStatus = 'idle' | 'loading' | 'found' | 'not_found' | 'error';

/**
 * Endereço do pagador. O CEP preenche rua e bairro sozinho; o hóspede só confere e informa o número.
 * Os dados seguem ao Asaas para o pagamento abrir preenchido (não ficam gravados no banco).
 */
export default function BillingAddressFields({
    value,
    onChange,
    disabled,
}: {
    value: BillingForm;
    onChange: (next: BillingForm) => void;
    disabled?: boolean;
}) {
    const [status, setStatus] = useState<LookupStatus>('idle');
    const latest = useRef(value);
    const numberRef = useRef<HTMLInputElement>(null);
    const lookedUp = useRef('');

    useEffect(() => {
        latest.current = value;
    });

    useEffect(() => {
        const digits = onlyDigits(value.postalCode);
        if (digits.length !== 8 || lookedUp.current === digits) return;
        lookedUp.current = digits;

        const controller = new AbortController();
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStatus('loading');
        fetch(`/api/cep/${digits}`, { signal: controller.signal })
            .then(async (response) => {
                if (response.status === 404) return setStatus('not_found');
                const data = await response.json().catch(() => null);
                if (!response.ok || !data) return setStatus('error');
                onChange({
                    ...latest.current,
                    address: data.address || latest.current.address,
                    province: data.province || latest.current.province,
                    city: data.city || '',
                    state: data.state || '',
                });
                setStatus('found');
                numberRef.current?.focus();
            })
            .catch((error) => {
                if ((error as Error)?.name !== 'AbortError') setStatus('error');
            });
        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value.postalCode]);

    const set = (patch: Partial<BillingForm>) => onChange({ ...value, ...patch });

    return (
        <div className="grid gap-4 md:col-span-2 md:grid-cols-2" data-testid="billing-address">
            <div className="space-y-2">
                <label htmlFor="billing-postal-code" className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="h-4 w-4 text-muted-foreground" /> CEP *
                </label>
                <input
                    id="billing-postal-code"
                    name="postalCode"
                    type="text"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    required
                    maxLength={9}
                    className={inputClass}
                    placeholder="00000-000"
                    value={value.postalCode}
                    onChange={(event) => {
                        lookedUp.current = '';
                        setStatus('idle');
                        set({ postalCode: formatPostalCode(event.target.value) });
                    }}
                    disabled={disabled}
                />
                <p className="min-h-4 text-xs text-muted-foreground" role="status">
                    {status === 'loading' ? 'Buscando endereço…' : null}
                    {status === 'found' ? [value.city, value.state].filter(Boolean).join(' – ') : null}
                    {status === 'not_found' ? 'CEP não encontrado. Preencha o endereço manualmente.' : null}
                    {status === 'error' ? 'Não foi possível buscar o CEP agora. Preencha o endereço manualmente.' : null}
                </p>
            </div>

            <div className="space-y-2">
                <label htmlFor="billing-address" className="text-sm font-medium">Rua *</label>
                <input
                    id="billing-address"
                    name="address"
                    type="text"
                    autoComplete="address-line1"
                    required
                    maxLength={255}
                    className={inputClass}
                    value={value.address}
                    onChange={(event) => set({ address: event.target.value })}
                    disabled={disabled}
                />
            </div>

            <div className="space-y-2">
                <label htmlFor="billing-number" className="text-sm font-medium">Número *</label>
                <input
                    id="billing-number"
                    name="addressNumber"
                    ref={numberRef}
                    type="text"
                    autoComplete="off"
                    required
                    maxLength={20}
                    className={inputClass}
                    placeholder="Ex.: 120 ou S/N"
                    value={value.addressNumber}
                    onChange={(event) => set({ addressNumber: event.target.value })}
                    disabled={disabled}
                />
            </div>

            <div className="space-y-2">
                <label htmlFor="billing-province" className="text-sm font-medium">Bairro *</label>
                <input
                    id="billing-province"
                    name="province"
                    type="text"
                    required
                    maxLength={100}
                    className={inputClass}
                    value={value.province}
                    onChange={(event) => set({ province: event.target.value })}
                    disabled={disabled}
                />
            </div>

            <div className="space-y-2 md:col-span-2">
                <label htmlFor="billing-complement" className="text-sm font-medium">Complemento (opcional)</label>
                <input
                    id="billing-complement"
                    name="complement"
                    type="text"
                    autoComplete="address-line2"
                    maxLength={255}
                    className={inputClass}
                    value={value.complement}
                    onChange={(event) => set({ complement: event.target.value })}
                    disabled={disabled}
                />
                <p className="text-xs text-muted-foreground">
                    Usado para preencher o pagamento no Asaas, assim você não digita seus dados duas vezes.
                </p>
            </div>
        </div>
    );
}
