'use client';

import * as React from 'react';
import type { Matcher } from 'react-day-picker';
import { ptBR } from 'date-fns/locale';

import { Calendar, type CalendarProps } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export type DateFieldProps = {
    /** Data selecionada. */
    value: Date | undefined;
    onSelect: (date: Date | undefined) => void;
    /** Datas bloqueadas no calendário. */
    disabled?: Matcher | Matcher[];
    /**
     * Mês exibido ao abrir. Padrão: o mês da data selecionada.
     * O conteúdo do popover é montado a cada abertura, então o calendário nunca abre "no mês de hoje" por engano.
     */
    openMonth?: Date;
    /** Visual do gatilho: cada formulário mantém o seu. */
    trigger: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    align?: 'start' | 'center' | 'end';
    contentClassName?: string;
    contentTestId?: string;
    collisionPadding?: number;
    sideOffset?: number;
    calendarClassName?: string;
    calendarClassNames?: CalendarProps['classNames'];
};

/** Seletor de data único (popover + calendário) compartilhado por todos os formulários de busca. */
export function DateField({
    value,
    onSelect,
    disabled,
    openMonth,
    trigger,
    open,
    onOpenChange,
    align = 'start',
    contentClassName,
    contentTestId,
    collisionPadding,
    sideOffset,
    calendarClassName,
    calendarClassNames,
}: DateFieldProps) {
    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            <PopoverContent
                align={align}
                className={contentClassName}
                data-testid={contentTestId}
                collisionPadding={collisionPadding}
                sideOffset={sideOffset}
            >
                <Calendar
                    key={(openMonth ?? value)?.toISOString() ?? 'empty'}
                    mode="single"
                    selected={value}
                    defaultMonth={openMonth ?? value}
                    onSelect={onSelect}
                    disabled={disabled}
                    initialFocus
                    locale={ptBR}
                    className={calendarClassName}
                    classNames={calendarClassNames}
                />
            </PopoverContent>
        </Popover>
    );
}
