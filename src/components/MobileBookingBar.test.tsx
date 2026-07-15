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
        mocks.pathname = '/';
        mocks.trackClickReservar.mockClear();
    });

    it('links to the booking search and tracks the click', () => {
        render(<MobileBookingBar />);

        const link = screen.getByRole('link', { name: /ver preços e disponibilidade/i });
        expect(link).toHaveAttribute('href', '/reservar');

        fireEvent.click(link);
        expect(mocks.trackClickReservar).toHaveBeenCalledWith('mobile_sticky');
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
