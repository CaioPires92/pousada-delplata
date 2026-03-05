'use client';

import { Button } from '@/components/ui/button';

type StepperProps = {
    label: string;
    value: number;
    min: number;
    max: number;
    onChange: (nextValue: number) => void;
};

export default function Stepper({ label, value, min, max, onChange }: StepperProps) {
    const canDecrement = value > min;
    const canIncrement = value < max;

    return (
        <div className="flex items-center gap-2">
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => onChange(Math.max(min, value - 1))}
                disabled={!canDecrement}
                aria-label={`Diminuir ${label}`}
            >
                -
            </Button>
            <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-border bg-background px-2 text-sm font-medium">
                {value}
            </span>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => onChange(Math.min(max, value + 1))}
                disabled={!canIncrement}
                aria-label={`Aumentar ${label}`}
            >
                +
            </Button>
        </div>
    );
}
