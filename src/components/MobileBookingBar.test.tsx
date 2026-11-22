import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MobileBookingBar from './MobileBookingBar';

const mocks = vi.hoisted(() => ({
    pathname: '/',
    push: vi.fn(),
}));

vi.mock('@/lib/analytics', () => ({
    trackClickReservar: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    usePathname: () => mocks.pathname,
    useRouter: () => ({ push: mocks.push }),
}));

describe('MobileBookingBar', () => {
    beforeEach(() => {
        mocks.pathname = '/acomodacoes';
        mocks.push.mockClear();
    });

    it('abre a busca com datas e ocupação selecionadas', async () => {
        render(<MobileBookingBar />);

        const link = await screen.findByRole('link', { name: /simular reserva/i });
        expect(link).toHaveAttribute('href', '/reservar');

        fireEvent.click(link);
        const destination = String(mocks.push.mock.calls[0]?.[0]);
        const params = new URL(destination, 'https://example.com').searchParams;
        const checkIn = new Date(`${params.get('checkIn')}T12:00:00`);
        const checkOut = new Date(`${params.get('checkOut')}T12:00:00`);

        expect(params.get('adults')).toBe('2');
        expect(params.get('children')).toBe('0');
        expect(checkOut.getTime() - checkIn.getTime()).toBe(24 * 60 * 60 * 1000);
    });

    it('inclui a quantidade de pets na busca', async () => {
        render(<MobileBookingBar />);

        fireEvent.click(screen.getByRole('button', { name: /Hóspedes/i }));
        fireEvent.click(await screen.findByRole('button', { name: /Aumentar pets/i }));
        fireEvent.click(screen.getByRole('button', { name: /Aumentar pets/i }));
        fireEvent.click(screen.getByRole('link', { name: /simular reserva/i }));

        expect(mocks.push).toHaveBeenCalledWith(expect.stringContaining('pets=2'));
    });

    it('exibe as datas bloqueadas com aparência mais escura', () => {
        render(<MobileBookingBar />);

        fireEvent.click(screen.getByText('Check-in').parentElement!.parentElement!);

        const disabledDay = document.querySelector('[data-disabled="true"]');
        expect(disabledDay).toHaveClass('!text-white/35', '!opacity-100');
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
