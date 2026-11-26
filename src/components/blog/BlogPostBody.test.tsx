import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BlogPostBody } from './BlogPostBody';
import { slugifyHeading } from '@/lib/slugify-heading';

const currentDateState = { value: '2026-09-20' };

vi.mock('@/lib/analytics', () => ({ trackClickReservar: vi.fn() }));

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

  it('mostra o crédito da foto com link para a origem', () => {
    render(<BlogPostBody content={[{
      type: 'image',
      src: '/fotos/jardim-aptos/DJI_0903.jpg',
      alt: 'Foto de teste',
      caption: 'Legenda',
      credit: { text: 'Prefeitura de Serra Negra', href: 'https://www.serranegra.sp.gov.br/' },
    }]} />);

    expect(screen.getByRole('link', { name: 'Prefeitura de Serra Negra' })).toHaveAttribute('href', 'https://www.serranegra.sp.gov.br/');
    expect(screen.getByText(/Foto:/)).toBeInTheDocument();
  });

  it('não repete as fontes no corpo quando a página as mostra em caixa própria', () => {
    render(<BlogPostBody hideSources content={[{
      type: 'source',
      label: 'Visite Serra Negra',
      href: 'https://visiteserranegra.com.br/agenda-de-eventos/',
    }]} />);

    expect(screen.queryByRole('link', { name: 'Visite Serra Negra' })).not.toBeInTheDocument();
  });

  it('dá âncora estável aos títulos, sem acento nem símbolos', () => {
    render(<BlogPostBody content={[{ type: 'heading', content: 'Como planejar a hospedagem?' }]} />);
    expect(screen.getByRole('heading', { name: 'Como planejar a hospedagem?' })).toHaveAttribute('id', 'como-planejar-a-hospedagem');
    expect(slugifyHeading('Onde ver as luzes')).toBe('onde-ver-as-luzes');
    expect(slugifyHeading('Térreo & Chalé')).toBe('terreo-chale');
  });

  it('o botão de reserva do artigo leva ao motor com as datas do evento já preenchidas', () => {
    render(<BlogPostBody content={[{
      type: 'cta',
      label: 'Ver disponibilidade para o Natal',
      checkIn: '2026-12-24',
      checkOut: '2026-12-27',
    }]} />);

    expect(screen.getByRole('link', { name: 'Ver disponibilidade para o Natal' })).toHaveAttribute(
      'href',
      '/reservar?checkIn=2026-12-24&checkOut=2026-12-27&adults=2&children=0',
    );
  });

  it('o botão de reserva some depois da data final configurada', () => {
    currentDateState.value = '2026-12-28';
    render(<BlogPostBody content={[{
      type: 'cta',
      label: 'Ver disponibilidade para o Natal',
      checkIn: '2026-12-24',
      checkOut: '2026-12-27',
      visibleUntil: '2026-12-27',
    }]} />);

    expect(screen.queryByRole('link', { name: 'Ver disponibilidade para o Natal' })).not.toBeInTheDocument();
  });
});
