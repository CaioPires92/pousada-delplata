import { beforeEach, describe, expect, it } from 'vitest';
import { appendCampaignAttribution, captureCampaignAttribution } from './campaign-attribution';

describe('campaign attribution', () => {
    beforeEach(() => window.sessionStorage.clear());

    it('copies only supported campaign parameters', () => {
        const source = new URLSearchParams('utm_source=google&utm_campaign=inverno&email=private@example.com');
        const target = new URLSearchParams('adults=2');
        appendCampaignAttribution(target, source);
        expect(target.get('utm_source')).toBe('google');
        expect(target.get('utm_campaign')).toBe('inverno');
        expect(target.has('email')).toBe(false);
    });

    it('restores campaign parameters during the same browser session', () => {
        captureCampaignAttribution(new URLSearchParams('utm_source=instagram&gclid=click-123'));
        const target = new URLSearchParams('children=0');
        appendCampaignAttribution(target, new URLSearchParams());
        expect(target.get('utm_source')).toBe('instagram');
        expect(target.get('gclid')).toBe('click-123');
    });
});
