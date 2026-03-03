import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BookingRowCard from './booking-row-card';
import type { Booking } from './types';

describe('BookingRowCard', () => {
    const onActionSelect = vi.fn();

    it('renderiza card com dados completos', () => {
        const booking: Booking = {
            id: 'abc123456789',
            adults: 2,
            children: 1,
            childrenAges: '[7]',
            checkIn: '2026-03-08T00:00:00.000Z',
            checkOut: '2026-03-10T00:00:00.000Z',
            totalPrice: 880,
            status: 'PENDING',
            createdAt: '2026-03-01T12:30:00.000Z',
            guest: {
                name: 'Maria Teste',
                email: 'maria@example.com',
                phone: '+55 11 99999-9999',
            },
            roomType: {
                name: 'Suíte Premium',
            },
            payment: {
                status: 'PENDING',
                amount: 880,
                method: 'CREDIT_CARD',
                cardBrand: 'VISA',
                installments: 3,
                provider: 'MERCADOPAGO',
            },
        };

        render(
            <BookingRowCard
                booking={booking}
                statusText="Pendente"
                statusClassName="statusPending"
                actionValue=""
                actionBusy={false}
                showActionBusy={false}
                testPaymentsEnabled
                onActionSelect={onActionSelect}
            />
        );

        expect(screen.getByText('Maria Teste')).toBeInTheDocument();
        expect(screen.getByText('Pendente')).toBeInTheDocument();
        expect(screen.getByText('Check-in: 08/03/2026')).toBeInTheDocument();
        expect(screen.getByText('Check-out: 10/03/2026')).toBeInTheDocument();
        expect(screen.getByText('R$ 880.00')).toBeInTheDocument();
        expect(screen.getByText('3 hósp. (2A/1C)')).toBeInTheDocument();
        expect(screen.getByText('Idades: 7')).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: /Ações da reserva/i })).toBeInTheDocument();
    });

    it('usa createdAt como fallback quando checkIn está ausente', () => {
        const booking: Booking = {
            id: 'def123456789',
            adults: 1,
            children: 0,
            checkIn: null,
            checkOut: null,
            totalPrice: 300,
            status: 'CONFIRMED',
            createdAt: '2026-04-15T15:00:00.000Z',
            guest: {
                name: 'João Silva',
                email: 'joao@example.com',
                phone: '+55 21 98888-7777',
            },
            roomType: {
                name: 'Standard',
            },
            payment: null,
        };

        render(
            <BookingRowCard
                booking={booking}
                statusText="Confirmada"
                statusClassName="statusConfirmed"
                actionValue=""
                actionBusy={false}
                showActionBusy={false}
                testPaymentsEnabled={false}
                onActionSelect={onActionSelect}
            />
        );

        expect(screen.getByText('Check-in: 15/04/2026')).toBeInTheDocument();
        expect(screen.getByText('Check-out: -')).toBeInTheDocument();
    });
});
