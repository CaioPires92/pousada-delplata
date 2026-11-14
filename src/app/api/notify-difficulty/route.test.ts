// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/email', () => ({
    normalizeSingleEmailAddress: (value: unknown) => {
        const email = typeof value === 'string' ? value.trim() : '';
        return /^[^\s,;<>]+@[^\s,;<>]+$/.test(email) ? email : null;
    },
    sendDifficultyAlertEmail: vi.fn(),
}));

import { sendDifficultyAlertEmail } from '@/lib/email';
import { POST } from './route';

let ipSequence = 40;
function request(body: Record<string, unknown>, fixedIp?: string) {
    ipSequence += 1;
    return new Request('https://example.com/api/notify-difficulty', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-forwarded-for': fixedIp || `198.51.100.${ipSequence}`,
        },
        body: JSON.stringify(body),
    });
}

const validBody = {
    guestName: 'Guest',
    guestEmail: 'guest@example.com',
    step: 'payment',
    reason: 'checkout failed',
};

describe('POST /api/notify-difficulty', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (sendDifficultyAlertEmail as any).mockResolvedValue({ success: true });
    });

    it('sends only bounded structured alert fields', async () => {
        const response = await POST(request({ ...validBody, cardLastFour: '1234' }));

        expect(response.status).toBe(200);
        expect(sendDifficultyAlertEmail).toHaveBeenCalledWith(expect.objectContaining({
            guestEmail: 'guest@example.com',
            cardLastFour: '1234',
        }));
    });

    it('rejects recipient lists before sending', async () => {
        const response = await POST(request({
            ...validBody,
            guestEmail: 'guest@example.com,attacker@example.net',
        }));

        expect(response.status).toBe(400);
        expect(sendDifficultyAlertEmail).not.toHaveBeenCalled();
    });

    it('rate limits repeated alerts', async () => {
        const fixedIp = '203.0.113.90';
        const responses = [];
        for (let attempt = 0; attempt < 4; attempt += 1) {
            responses.push(await POST(request(validBody, fixedIp)));
        }

        expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 429]);
        expect(sendDifficultyAlertEmail).toHaveBeenCalledTimes(3);
    });
});
