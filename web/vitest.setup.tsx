import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

// Clean up after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock Next.js Navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn((key) => {
        if(key === 'checkIn') return '2026-01-01';
        if(key === 'checkOut') return '2026-01-05';
        if(key === 'adults') return '2';
        return null;
    }),
  }),
}));

// Mock Image component (Next.js Image doesn't work well in jsdom)
vi.mock('next/image', () => ({
  default: (props: React.ComponentProps<'img'> & { fill?: boolean }) => {
    const { fill, ...rest } = props;
    void fill;
    return React.createElement('img', { ...rest, alt: rest.alt || 'mock-image' });
  },
}));

// Mock fetch globally
global.fetch = vi.fn();
