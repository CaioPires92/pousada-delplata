import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HeroVideo, { shouldPlayBackgroundVideo } from './HeroVideo';

function mockMatchMedia(matches: Record<string, boolean>) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: Boolean(matches[query]),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe('shouldPlayBackgroundVideo', () => {
  it('não toca com pedido de menos movimento, economia de dados ou conexão lenta', () => {
    expect(shouldPlayBackgroundVideo(true)).toBe(false);
    expect(shouldPlayBackgroundVideo(false, { saveData: true })).toBe(false);
    expect(shouldPlayBackgroundVideo(false, { effectiveType: '3g' })).toBe(false);
    expect(shouldPlayBackgroundVideo(false, { effectiveType: '4g' })).toBe(true);
    expect(shouldPlayBackgroundVideo(false, null)).toBe(true);
  });
});

describe('HeroVideo', () => {
  afterEach(() => vi.restoreAllMocks());

  it('usa o arquivo horizontal no computador e o vertical no celular', () => {
    mockMatchMedia({ '(min-width: 768px)': true });
    const desktop = render(<HeroVideo desktopSrc="/d.mp4" mobileSrc="/m.mp4" />);
    expect(desktop.container.querySelector('video')?.getAttribute('src')).toBe('/d.mp4');
    desktop.unmount();

    mockMatchMedia({ '(min-width: 768px)': false });
    const mobile = render(<HeroVideo desktopSrc="/d.mp4" mobileSrc="/m.mp4" />);
    expect(mobile.container.querySelector('video')?.getAttribute('src')).toBe('/m.mp4');
  });

  it('não renderiza vídeo quando a pessoa pede menos movimento', () => {
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': true, '(min-width: 768px)': true });
    const { container } = render(<HeroVideo desktopSrc="/d.mp4" mobileSrc="/m.mp4" />);
    expect(container.querySelector('video')).toBeNull();
  });

  it('o vídeo é decorativo: sem som, em loop e escondido de leitores de tela', () => {
    mockMatchMedia({ '(min-width: 768px)': true });
    const { container } = render(<HeroVideo desktopSrc="/d.mp4" mobileSrc="/m.mp4" />);
    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.getAttribute('aria-hidden')).toBe('true');
  });
});
