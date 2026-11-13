'use client';

import { Minus, PawPrint, Plus } from 'lucide-react';

import { MAX_BOOKING_GUESTS } from '@/lib/booking-capacity';
import { maxChildrenFor, type ChildAge } from '@/lib/booking-search';
import { cn } from '@/lib/utils';
import { PET_POLICY_NOTICE } from '@/lib/pet-policy';

export type GuestsValue = { adults: number; children: number; childrenAges: ChildAge[]; pets: number };

type Tone = 'light' | 'dark';

const TONES: Record<Tone, { title: string; muted: string; card: string; stepper: string; select: string; notice: string }> = {
    light: {
        title: 'text-brand-brown-dark',
        muted: 'text-brand-brown-dark/70',
        card: 'border-[color:var(--line-dark)] bg-[color:var(--brand-white)]/70',
        stepper: 'border-[color:var(--brand-gold)]/60 bg-[color:var(--brand-white)] text-brand-brown-dark hover:bg-[color:var(--brand-cream)]',
        select: 'border-[color:var(--brand-gold)]/55 bg-[color:var(--brand-white)] text-brand-brown-dark',
        notice: 'border-[color:var(--line-dark)] bg-[color:var(--brand-white)]/70 text-brand-brown-dark',
    },
    dark: {
        title: 'text-white',
        muted: 'text-white/70',
        card: 'border-white/10 bg-white/5',
        stepper: 'border-white/20 bg-transparent text-white hover:bg-white/10',
        select: 'border-white/20 bg-brand-brown-dark text-white',
        notice: 'border-white/10 bg-white/5 text-white/85',
    },
};

type GuestsPanelProps = {
    value: GuestsValue;
    /** Recebe o valor já normalizado (lotação e vetor de idades). */
    onChange: (next: GuestsValue) => void;
    tone?: Tone;
    className?: string;
    /** Valor inicial da idade de uma criança recém-adicionada. */
    newChildAge?: ChildAge;
    /** Erros de validação mostrados junto ao campo certo. */
    guestsError?: string;
    agesError?: string;
};

function Stepper({
    label,
    hint,
    count,
    onMinus,
    onPlus,
    minusDisabled,
    plusDisabled,
    tone,
}: {
    label: string;
    hint: string;
    count: number;
    onMinus: () => void;
    onPlus: () => void;
    minusDisabled: boolean;
    plusDisabled: boolean;
    tone: Tone;
}) {
    const t = TONES[tone];
    const btn = cn('inline-flex h-9 w-9 items-center justify-center rounded-none border p-0 transition-colors disabled:cursor-not-allowed disabled:opacity-40', t.stepper);
    return (
        <div className={cn('flex items-center justify-between rounded-none border px-4 py-3', t.card)}>
            <div>
                <p className={cn('text-sm font-semibold', t.title)}>{label}</p>
                <p className={cn('text-xs', t.muted)}>{hint}</p>
            </div>
            <div className="flex items-center gap-2">
                <button type="button" className={btn} onClick={onMinus} disabled={minusDisabled} aria-label={`Diminuir ${label.toLowerCase()}`}>
                    <Minus className="h-4 w-4" />
                </button>
                <span className={cn('inline-flex min-w-8 items-center justify-center text-base font-semibold', t.title)} aria-live="polite">
                    {count}
                </span>
                <button type="button" className={btn} onClick={onPlus} disabled={plusDisabled} aria-label={`Aumentar ${label.toLowerCase()}`}>
                    <Plus className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}

/** Painel de ocupação único (adultos, crianças, idades) usado por todos os formulários de busca. */
export function GuestsPanel({ value, onChange, tone = 'light', className, newChildAge = 0, guestsError, agesError }: GuestsPanelProps) {
    const t = TONES[tone];
    const maxChildren = maxChildrenFor(value.adults);

    const setAdults = (adults: number) => {
        const nextAdults = Math.min(Math.max(adults, 1), MAX_BOOKING_GUESTS);
        const nextChildren = Math.min(value.children, maxChildrenFor(nextAdults));
        onChange({ ...value, adults: nextAdults, children: nextChildren, childrenAges: value.childrenAges.slice(0, nextChildren) });
    };

    const setChildren = (children: number) => {
        const nextChildren = Math.min(Math.max(children, 0), maxChildren);
        const ages = value.childrenAges.slice(0, nextChildren);
        while (ages.length < nextChildren) ages.push(newChildAge);
        onChange({ ...value, children: nextChildren, childrenAges: ages });
    };

    const setAge = (index: number, age: ChildAge) => {
        const ages = value.childrenAges.slice();
        ages[index] = age;
        onChange({ ...value, childrenAges: ages });
    };

    return (
        <div className={cn('space-y-4', className)} data-testid="guests-panel">
            <div className="space-y-1">
                <p className={cn('font-accent text-[0.62rem] font-semibold uppercase tracking-[0.16em]', t.muted)}>Configurar ocupação</p>
                <p className={cn('text-sm', t.muted)}>
                    Até {MAX_BOOKING_GUESTS} hóspedes por quarto, conforme a acomodação. Crianças de 0 a 5 anos não pagam, mas contam na ocupação.
                </p>
            </div>

            <Stepper
                label="Adultos"
                hint="A partir de 12 anos"
                count={value.adults}
                onMinus={() => setAdults(value.adults - 1)}
                onPlus={() => setAdults(value.adults + 1)}
                minusDisabled={value.adults <= 1}
                plusDisabled={value.adults >= MAX_BOOKING_GUESTS}
                tone={tone}
            />

            <Stepper
                label="Crianças"
                hint="Até 11 anos"
                count={value.children}
                onMinus={() => setChildren(value.children - 1)}
                onPlus={() => setChildren(value.children + 1)}
                minusDisabled={value.children <= 0}
                plusDisabled={value.children >= maxChildren}
                tone={tone}
            />

            <Stepper
                label="Pets"
                hint="Aceitos mediante taxa por diária"
                count={value.pets}
                onMinus={() => onChange({ ...value, pets: Math.max(0, value.pets - 1) })}
                onPlus={() => onChange({ ...value, pets: Math.min(10, value.pets + 1) })}
                minusDisabled={value.pets <= 0}
                plusDisabled={value.pets >= 10}
                tone={tone}
            />

            {guestsError ? <p role="alert" className="text-xs font-medium text-destructive">{guestsError}</p> : null}

            {value.children > 0 ? (
                <div className={cn('space-y-2 rounded-none border p-4', t.card)}>
                    <p className={cn('text-sm font-semibold', t.title)}>Idade das crianças</p>
                    <p className={cn('text-xs', t.muted)}>0 a 5 anos: cortesia. 6 a 11 anos: tarifa de criança. A partir de 12 anos: conta como adulto.</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {value.childrenAges.slice(0, value.children).map((age, index) => (
                            <select
                                key={index}
                                aria-label={`Idade da criança ${index + 1}`}
                                value={age === null ? '' : String(age)}
                                onChange={(event) => setAge(index, event.target.value === '' ? null : Number.parseInt(event.target.value, 10))}
                                className={cn('h-11 w-full rounded-none border px-3 text-sm font-medium', t.select)}
                            >
                                <option value="" disabled>{`Criança ${index + 1}`}</option>
                                {Array.from({ length: 18 }, (_, ageOption) => (
                                    <option key={ageOption} value={ageOption}>{`${ageOption} ${ageOption === 1 ? 'ano' : 'anos'}`}</option>
                                ))}
                            </select>
                        ))}
                    </div>
                    {agesError ? <p role="alert" className="text-xs font-medium text-destructive">{agesError}</p> : null}
                </div>
            ) : null}

            <p className={cn('flex items-center gap-2 rounded-none border p-3 text-xs font-medium', t.notice)}>
                <PawPrint className="h-4 w-4 shrink-0" />
                {PET_POLICY_NOTICE}
            </p>
        </div>
    );
}
