import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CHECKIN_MESSAGE,
  buildCheckinWhatsAppUrl,
  fillCheckinMessage,
  firstName,
  formatCheckinDate,
  normalizeGuestPhone,
} from './checkin-whatsapp';

describe('normalizeGuestPhone', () => {
  it('adds the Brazilian country code to a local number', () => {
    expect(normalizeGuestPhone('(19) 99965-4866', 'BR')).toBe('5519999654866');
    expect(normalizeGuestPhone('19 3333-4444')).toBe('551933334444');
  });

  it('keeps a number that already has the country code', () => {
    expect(normalizeGuestPhone('+55 19 99965-4866', 'BR')).toBe('5519999654866');
  });

  it('drops a leading zero before the area code', () => {
    expect(normalizeGuestPhone('019 99965-4866', 'BR')).toBe('5519999654866');
  });

  it('rejects empty, short and unsupported-country numbers', () => {
    expect(normalizeGuestPhone('', 'BR')).toBeNull();
    expect(normalizeGuestPhone(null)).toBeNull();
    expect(normalizeGuestPhone('99965', 'BR')).toBeNull();
    expect(normalizeGuestPhone('123456789', 'ZZ')).toBeNull();
  });

  it('accepts other known countries', () => {
    expect(normalizeGuestPhone('11 2345 6789', 'AR')).toBe('541123456789');
  });
});

describe('message', () => {
  it('formats dates and names', () => {
    expect(formatCheckinDate('2026-11-27T14:00:00-03:00')).toBe('27/11');
    expect(firstName('SITE - maria da SILVA')).toBe('Maria');
    expect(firstName('')).toBe('hóspede');
  });

  it('fills every placeholder', () => {
    const text = fillCheckinMessage(DEFAULT_CHECKIN_MESSAGE, {
      nome: 'JOÃO PEREIRA',
      checkin: '2026-11-27',
      link: 'https://checkin.hospedin.com/abc',
    });
    expect(text).toContain('Olá, João!');
    expect(text).toContain('27/11');
    expect(text).toContain('https://checkin.hospedin.com/abc');
    expect(text).not.toContain('{');
  });

  it('builds an encoded wa.me link', () => {
    const url = buildCheckinWhatsAppUrl('5519999654866', 'Olá!\nlink');
    expect(url).toBe('https://wa.me/5519999654866?text=Ol%C3%A1!%0Alink');
  });
});
