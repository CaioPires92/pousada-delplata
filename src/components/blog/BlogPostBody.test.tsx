import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BlogPostBody } from './BlogPostBody';

const currentDateState = { value: '2026-09-20' };

vi.mock('@/hooks/useCurrentDateKey', () => ({
  useCurrentDateKey: () => currentDateState.value,
}));

describe('BlogPostBody', () => {
  beforeEach(() => {
    currentDateState.value = '2026-09-20';
  });

  it('mantem o conteudo temporario ate a data final', () => {
    render(<BlogPostBody content={[{
      type: 'paragraph',
      content: "Festa D'Italia",
      visibleUntil: '2026-09-20',
    }]} />);

    expect(screen.getByText("Festa D'Italia")).toBeInTheDocument();
  });

  it('remove o conteudo temporario depois da data final', () => {
    currentDateState.value = '2026-09-21';
    render(<BlogPostBody content={[{
      type: 'paragraph',
      content: "Festa D'Italia",
      visibleUntil: '2026-09-20',
    }]} />);

    expect(screen.queryByText("Festa D'Italia")).not.toBeInTheDocument();
  });
});
