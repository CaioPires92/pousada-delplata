import { afterEach, describe, expect, it, vi } from 'vitest';

import { opsLog } from './ops-log';

function captureInfo(fields: Record<string, unknown>) {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    opsLog('info', 'TEST_EVENT', fields);
    return JSON.parse(String(spy.mock.calls.at(-1)?.[0]));
}

describe('opsLog', () => {
    afterEach(() => vi.restoreAllMocks());

    it('replaces the full booking id with its short prefix', () => {
        const line = captureInfo({ bookingId: '0123456789abcdef-full-id', paymentId: '42' });
        expect(line).not.toHaveProperty('bookingId');
        expect(line).toMatchObject({ event: 'TEST_EVENT', bookingIdShort: '01234567', paymentId: '42' });
        expect(JSON.stringify(line)).not.toContain('full-id');
    });

    it('keeps an explicit short id and drops empty booking ids', () => {
        expect(captureInfo({ bookingId: 'abcdefgh-1234', bookingIdShort: 'abcdefgh' }))
            .toMatchObject({ bookingIdShort: 'abcdefgh' });
        const line = captureInfo({ bookingId: undefined, reason: 'x' });
        expect(line).not.toHaveProperty('bookingId');
        expect(line).not.toHaveProperty('bookingIdShort');
    });
});
