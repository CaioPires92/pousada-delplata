import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchWidget from './SearchWidget';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => '/',
}));

describe('SearchWidget', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pushMock.mockReset();
  });

  it('disables search when ages for children are missing', () => {
    render(<SearchWidget />);
    const adultsSelect = screen.getByLabelText(/Adultos/i) as HTMLSelectElement;
    const childrenSelect = screen.getByLabelText(/Crianças/i) as HTMLSelectElement;
    fireEvent.change(adultsSelect, { target: { value: '2' } });
    fireEvent.change(childrenSelect, { target: { value: '1' } });
    const submit = screen.getByRole('button', { name: /Buscar/i });
    expect(submit).toBeDisabled();
    expect(screen.getByText(/Informe a idade das crianças/i)).toBeInTheDocument();
  });

  // Nota: o widget evita seleção acima da capacidade via UI.
  // A validação de fallback visual é exercitada indiretamente nos testes de fluxo E2E.

  it('navega para /reservar quando há disponibilidade', async () => {
    (global as any).fetch = vi.fn(async () => new Response(JSON.stringify([{ id: 'rt1' }]), { status: 200 }));
    render(<SearchWidget />);
    const btn = screen.getByRole('button', { name: /Buscar/i });
    fireEvent.click(btn);
    await new Promise(r => setTimeout(r, 0));
    expect(pushMock).toHaveBeenCalled();
    const callArg = pushMock.mock.calls[0][0] as string;
    expect(callArg).toMatch(/\/reservar\?/);
  });

  it('exibe mensagem de sem disponibilidade quando API retorna vazio', async () => {
    (global as any).fetch = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
    render(<SearchWidget />);
    const btn = screen.getByRole('button', { name: /Buscar/i });
    fireEvent.click(btn);
    await new Promise(r => setTimeout(r, 0));
    expect(screen.getByText(/Sem disponibilidade/i)).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('exibe erro retornado pela API quando status não ok', async () => {
    (global as any).fetch = vi.fn(async () => new Response(JSON.stringify({ error: 'Erro simulado' }), { status: 500 }));
    render(<SearchWidget />);
    const btn = screen.getByRole('button', { name: /Buscar/i });
    fireEvent.click(btn);
    await new Promise(r => setTimeout(r, 0));
    expect(screen.getByText(/Erro simulado/i)).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
