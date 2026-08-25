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

  it('renderiza uma fonte externa identificada', () => {
    render(<BlogPostBody content={[{
      type: 'source',
      label: 'F2 Serra Negra',
      href: 'https://www.f2serranegra.com.br/aniversario-serra-negra',
    }]} />);

    expect(screen.getByRole('link', { name: 'F2 Serra Negra' })).toHaveAttribute(
      'href',
      'https://www.f2serranegra.com.br/aniversario-serra-negra'
    );
  });
});
