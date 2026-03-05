'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Stepper from './Stepper';

type GuestSelectorConfirmPayload = {
    adults: number;
    children: number;
    childrenAges: number[];
};

type GuestSelectorPopoverProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    adults: number;
    children: number;
    childrenAges: number[];
    onConfirm: (payload: GuestSelectorConfirmPayload) => void;
    trigger: ReactNode;
};

function normalizeAges(count: number, ages: Array<number | null | undefined>) {
    const normalizedCount = Math.max(0, Math.floor(count));
    const next: Array<number | null> = ages
        .slice(0, normalizedCount)
        .map((age) => (typeof age === 'number' && Number.isFinite(age) ? Math.min(17, Math.max(0, age)) : null));

    while (next.length < normalizedCount) next.push(null);
    return next;
}

export default function GuestSelectorPopover({
    open,
    onOpenChange,
    adults,
    children,
    childrenAges,
    onConfirm,
    trigger,
}: GuestSelectorPopoverProps) {
    const [adultsDraft, setAdultsDraft] = useState(2);
    const [childrenDraft, setChildrenDraft] = useState(0);
    const [childrenAgesDraft, setChildrenAgesDraft] = useState<Array<number | null>>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;
        const normalizedAdults = Math.min(10, Math.max(1, adults || 1));
        const normalizedChildren = Math.min(10, Math.max(0, children || 0));
        setAdultsDraft(normalizedAdults);
        setChildrenDraft(normalizedChildren);
        setChildrenAgesDraft(normalizeAges(normalizedChildren, childrenAges));
        setError('');
    }, [adults, children, childrenAges, open]);

    const normalizedChildrenAgesDraft = useMemo(
        () => normalizeAges(childrenDraft, childrenAgesDraft),
        [childrenAgesDraft, childrenDraft]
    );

    const handleChildrenChange = useCallback((nextChildren: number) => {
        const normalizedChildren = Math.min(10, Math.max(0, nextChildren));
        setChildrenDraft(normalizedChildren);
        setChildrenAgesDraft((prev) => normalizeAges(normalizedChildren, prev));
        setError('');
    }, []);

    const handleConfirm = useCallback(() => {
        if (childrenDraft > 0) {
            const hasMissingAge = normalizedChildrenAgesDraft.some((age) => age === null);
            if (hasMissingAge) {
                setError('Informe a idade de todas as crianças.');
                return;
            }
        }

        onConfirm({
            adults: Math.min(10, Math.max(1, adultsDraft)),
            children: Math.min(10, Math.max(0, childrenDraft)),
            childrenAges: normalizedChildrenAgesDraft.filter((age): age is number => typeof age === 'number'),
        });
        setError('');
        onOpenChange(false);
    }, [adultsDraft, childrenDraft, normalizedChildrenAgesDraft, onConfirm, onOpenChange]);

    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            <PopoverContent align="end" className="w-[320px] p-4">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Adultos</span>
                        <Stepper
                            label="adultos"
                            value={adultsDraft}
                            min={1}
                            max={10}
                            onChange={(next) => {
                                setAdultsDraft(Math.min(10, Math.max(1, next)));
                                setError('');
                            }}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Crianças</span>
                        <Stepper
                            label="crianças"
                            value={childrenDraft}
                            min={0}
                            max={10}
                            onChange={handleChildrenChange}
                        />
                    </div>

                    {childrenDraft > 0 ? (
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Idade da criança</p>
                            <div className="space-y-2">
                                {normalizedChildrenAgesDraft.map((age, index) => (
                                    <select
                                        key={index}
                                        value={age ?? ''}
                                        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                                        onChange={(event) => {
                                            const rawValue = event.target.value;
                                            const nextAge = rawValue === '' ? null : Number.parseInt(rawValue, 10);
                                            setChildrenAgesDraft((prev) => {
                                                const next = normalizeAges(childrenDraft, prev);
                                                next[index] = Number.isFinite(nextAge as number) ? (nextAge as number) : null;
                                                return next;
                                            });
                                            setError('');
                                        }}
                                        aria-label={`Idade da criança ${index + 1}`}
                                    >
                                        <option value="">Selecione</option>
                                        {Array.from({ length: 18 }, (_, ageOption) => (
                                            <option key={ageOption} value={ageOption}>
                                                {ageOption}
                                            </option>
                                        ))}
                                    </select>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}

                    <Button type="button" className="w-full" onClick={handleConfirm}>
                        Confirmar
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}

export type { GuestSelectorConfirmPayload };
