import { describe, expect, it } from 'vitest';
import { SPECIAL_DATES, formatBookingRange } from '@/constants/specialDates';
import { getAllBlogPosts, getBlogPostBySlug } from './blog';

const EVENT_SLUG = 'festa-ditalia-serra-negra-2026';

describe('blog post expiration', () => {
  it('mantem a publicacao da Festa D Italia ate o ultimo dia', () => {
    expect(getBlogPostBySlug(EVENT_SLUG, '2026-09-20')?.slug).toBe(EVENT_SLUG);
    expect(getAllBlogPosts('2026-09-20').some((post) => post.slug === EVENT_SLUG)).toBe(true);
  });

  it('remove a publicacao da Festa D Italia depois do evento', () => {
    expect(getBlogPostBySlug(EVENT_SLUG, '2026-09-21')).toBeUndefined();
    expect(getAllBlogPosts('2026-09-21').some((post) => post.slug === EVENT_SLUG)).toBe(false);
  });
});

describe('artigo do Natal ligado ao motor de reservas', () => {
  const natal = SPECIAL_DATES.find((item) => item.id === 'natal-2026');
  const post = getBlogPostBySlug('natal-luzes-da-serra-2026-serra-negra', '2026-11-24');

  it('usa as mesmas datas do período de Natal cadastrado no site', () => {
    expect(natal).toBeDefined();
    expect(post?.bookingCta?.checkIn).toBe(natal?.dateFrom);
    expect(post?.bookingCta?.checkOut).toBe(natal?.dateTo);
    const bloco = post?.content.find((block) => block.type === 'cta');
    expect(bloco && bloco.type === 'cta' ? [bloco.checkIn, bloco.checkOut] : null).toEqual([natal?.dateFrom, natal?.dateTo]);
  });

  it('formata o intervalo para o rótulo do botão', () => {
    expect(formatBookingRange('2026-12-24', '2026-12-27')).toBe('24 a 27/12');
    expect(formatBookingRange('2026-12-30', '2027-01-02')).toBe('30/12 a 02/01');
  });
});

