import { describe, expect, it } from 'vitest';
import { isMobileRequest, isMobileUserAgent } from '@/lib/device';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const ANDROID_PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
const ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

describe('isMobileUserAgent', () => {
    it('reconhece celulares', () => {
        expect(isMobileUserAgent(IPHONE)).toBe(true);
        expect(isMobileUserAgent(ANDROID_PHONE)).toBe(true);
    });

    it('não trata tablet nem desktop como celular', () => {
        expect(isMobileUserAgent(IPAD)).toBe(false);
        expect(isMobileUserAgent(ANDROID_TABLET)).toBe(false);
        expect(isMobileUserAgent(DESKTOP)).toBe(false);
    });

    it('sem User-Agent não é mobile', () => {
        expect(isMobileUserAgent(null)).toBe(false);
        expect(isMobileUserAgent(undefined)).toBe(false);
        expect(isMobileUserAgent('')).toBe(false);
    });

    it('isMobileRequest lê o header user-agent', () => {
        expect(isMobileRequest(new Request('http://x', { headers: { 'user-agent': IPHONE } }))).toBe(true);
        expect(isMobileRequest(new Request('http://x'))).toBe(false);
    });
});
