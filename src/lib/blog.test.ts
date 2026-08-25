import { describe, expect, it } from 'vitest';
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
