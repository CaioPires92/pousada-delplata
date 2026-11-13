import { Mail, Phone, User } from 'lucide-react';

import { formatCpf } from '@/lib/cpf';

export type ThirdPartyPayerForm = { name: string; email: string; phone: string };

type PayerFieldsProps = {
    payerIsGuest: boolean;
    onPayerIsGuestChange: (payerIsGuest: boolean) => void;
    thirdPartyPayer: ThirdPartyPayerForm;
    onThirdPartyPayerChange: (update: (current: ThirdPartyPayerForm) => ThirdPartyPayerForm) => void;
    payerCpf: string;
    onPayerCpfChange: (cpf: string) => void;
    disabled?: boolean;
};

const inputClassName = 'flex h-10 w-full rounded-none border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

// Responsável pelo pagamento: por padrão o hóspede; opcionalmente outra pessoa.
// Usado na etapa de dados e na correção após erro no pagamento (sem criar nova reserva).
export default function PayerFields({
    payerIsGuest,
    onPayerIsGuestChange,
    thirdPartyPayer,
    onThirdPartyPayerChange,
    payerCpf,
    onPayerCpfChange,
    disabled = false,
}: PayerFieldsProps) {
    const updateThirdParty = (field: keyof ThirdPartyPayerForm, value: string) => {
        onThirdPartyPayerChange((current) => ({ ...current, [field]: value }));
    };

    return (
        <>
            <div className="space-y-3 border border-brand-brown-dark/10 p-4">
                <label htmlFor="third-party-payer" className="flex cursor-pointer items-center gap-3 text-sm font-medium">
                    <input
                        id="third-party-payer"
                        type="checkbox"
                        checked={!payerIsGuest}
                        onChange={(event) => onPayerIsGuestChange(!event.target.checked)}
                        disabled={disabled}
                    />
                    Outra pessoa fará o pagamento
                </label>
                {payerIsGuest ? (
                    <p className="text-xs text-muted-foreground">O hóspede informado é o responsável pelo pagamento.</p>
                ) : (
                    <div className="space-y-4">
                        <p className="text-xs text-muted-foreground">Informe os dados de quem vai pagar. O cadastro do hóspede não é alterado.</p>
                        <div className="space-y-2">
                            <label htmlFor="payer-name" className="text-sm font-medium flex items-center gap-2">
                                <User className="w-4 h-4 text-muted-foreground" /> Nome e sobrenome do pagador *
                            </label>
                            <input
                                type="text"
                                id="payer-name"
                                name="payer-name"
                                autoComplete="off"
                                required
                                maxLength={120}
                                className={inputClassName}
                                placeholder="Como consta no CPF"
                                value={thirdPartyPayer.name}
                                onChange={(event) => updateThirdParty('name', event.target.value)}
                                disabled={disabled}
                            />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <label htmlFor="payer-email" className="text-sm font-medium flex items-center gap-2">
                                    <Mail className="w-4 h-4 text-muted-foreground" /> E-mail do pagador (opcional)
                                </label>
                                <input
                                    type="email"
                                    id="payer-email"
                                    name="payer-email"
                                    autoComplete="off"
                                    className={inputClassName}
                                    value={thirdPartyPayer.email}
                                    onChange={(event) => updateThirdParty('email', event.target.value)}
                                    disabled={disabled}
                                />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="payer-phone" className="text-sm font-medium flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-muted-foreground" /> Telefone do pagador (opcional)
                                </label>
                                <input
                                    type="tel"
                                    id="payer-phone"
                                    name="payer-phone"
                                    autoComplete="off"
                                    inputMode="tel"
                                    className={inputClassName}
                                    placeholder="(00) 00000-0000"
                                    value={thirdPartyPayer.phone}
                                    onChange={(event) => updateThirdParty('phone', event.target.value)}
                                    disabled={disabled}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <div className="space-y-2">
                <label htmlFor="cpf" className="text-sm font-medium flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" /> CPF do pagador *
                </label>
                <input
                    type="text"
                    id="cpf"
                    name="cpf"
                    autoComplete="off"
                    inputMode="numeric"
                    required
                    maxLength={14}
                    className={inputClassName}
                    placeholder="000.000.000-00"
                    value={payerCpf}
                    onChange={(event) => onPayerCpfChange(formatCpf(event.target.value))}
                    disabled={disabled}
                />
                <p className="text-xs text-muted-foreground">
                    {payerIsGuest
                        ? 'CPF do hóspede, usado somente para identificar o pagador no Mercado Pago.'
                        : 'CPF do pagador informado acima, usado somente para identificá-lo no Mercado Pago.'}
                </p>
            </div>
        </>
    );
}
