import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MobileBookingBar from './MobileBookingBar';

const mocks = vi.hoisted(() => ({
    pathname: '/',
    trackClickReservar: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    usePathname: () => mocks.pathname,
}));

vi.mock('@/lib/analytics', () => ({
    trackClickReservar: mocks.trackClickReservar,
}));

describe('MobileBookingBar', () => {
    beforeEach(() => {
        mocks.pathname = '/acomodacoes';
        mocks.trackClickReservar.mockClear();
        sessionStorage.clear();
    });

    it('links to the booking search and tracks the desktop click', async () => {
        render(<MobileBookingBar />);

        const link = await screen.findByRole('link', { name: /ver disponibilidade/i });
        expect(link).toHaveAttribute('href', '/reservar');

        fireEvent.click(link);
        expect(mocks.trackClickReservar).toHaveBeenCalledWith('booking_assistant_desktop');
    });

    it('waits for interaction before showing on the home page', () => {
        mocks.pathname = '/';
        render(<MobileBookingBar />);

        expect(screen.queryByRole('link', { name: /ver disponibilidade/i })).not.toBeInTheDocument();

        fireEvent(window, new Event('reservar-cta-interaction'));

        expect(screen.getByRole('link', { name: /ver disponibilidade/i })).toBeInTheDocument();
    });

    it('can be dismissed for the current session', async () => {
        render(<MobileBookingBar />);

        const closeButtons = await screen.findAllByRole('button', { name: /fechar lembrete de reserva/i });
        fireEvent.click(closeButtons[0]);

        expect(sessionStorage.getItem('delplata-booking-assistant-dismissed')).toBe('1');
        expect(screen.queryByRole('link', { name: /ver disponibilidade/i })).not.toBeInTheDocument();
    });

    it.each(['/reservar', '/reservar/confirmacao', '/admin', '/admin/reservas'])(
        'does not render on %s',
        (pathname) => {
            mocks.pathname = pathname;
            const { container } = render(<MobileBookingBar />);
            expect(container).toBeEmptyDOMElement();
        },
    );
});
