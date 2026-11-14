import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PromocoesPage from './page';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const json = (data: unknown, status = 200): Response =>
    ({ ok: status >= 200 && status < 300, status, json: async () => data, text: async () => JSON.stringify(data) }) as Response;

const basePromotion = {
    id: 'promo-1',
    name: 'Mobile 10%',
    badgeLabel: null,
    type: 'CUSTOM',
    active: true,
    discountPercent: 10,
    maxDiscountAmount: null,
    minDaysBeforeCheckIn: null,
    maxDaysBeforeCheckIn: null,
    stayStart: '2026-11-01T00:00:00.000Z',
    stayEnd: '2026-11-30T00:00:00.000Z',
    excludedStayDates: JSON.stringify([{ from: '2026-11-25', to: '2026-11-25' }, { from: '2026-11-14', to: '2026-11-16' }]),
    bookableFrom: null,
    bookableUntil: null,
    minNights: null,
    allowedRoomTypeIds: null,
    stackWithCoupons: false,
    allowedCouponIds: null,
    stackWithPromotions: false,
    allowedPromotionIds: null,
    exclusive: false,
    audience: 'all',
    showBadge: true,
};

function setupFetch(promotions: unknown[] = []) {
    const saved: Array<{ url: string; method: string; body: Record<string, unknown> }> = [];
    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method ?? 'GET';
        if (url.includes('/api/admin/promotions') && method !== 'GET') {
            saved.push({ url, method, body: JSON.parse(String(init?.body ?? '{}')) });
            return json({ id: 'novo' }, 201);
        }
        if (url.includes('/api/admin/promotions')) return json(promotions);
        if (url.includes('/api/admin/rooms')) return json([{ id: 'room-1', name: 'Quarto Triplo' }]);
        if (url.includes('/api/admin/coupons')) return json([]);
        return json([]);
    });
    return saved;
}

async function openNewForm() {
    fireEvent.click(await screen.findByRole('button', { name: /Nova promoção/ }, { timeout: 5000 }));
    return screen.findByRole('dialog', { name: 'Formulário de promoção' }, { timeout: 5000 });
}

describe('Admin Promoções — datas em que não vale', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('mostra no cartão em quais datas a promoção não vale', async () => {
        setupFetch([basePromotion]);
        render(<PromocoesPage />);

        expect(await screen.findByText(/Não vale em: 14\/11\/2026 a 16\/11\/2026, 25\/11\/2026/, undefined, { timeout: 5000 })).toBeInTheDocument();
    }, 30000);

    it('adiciona uma exceção de um dia, mostra a etiqueta e envia na gravação', async () => {
        const saved = setupFetch();
        render(<PromocoesPage />);
        await openNewForm();

        fireEvent.change(screen.getByLabelText(/Nome da promoção/), { target: { value: 'Genius dinâmico' } });
        fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-11-25' } });
        fireEvent.click(screen.getByRole('button', { name: 'Adicionar exceção' }));

        expect(await screen.findByRole('button', { name: 'Remover exceção 25/11/2026' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
        await waitFor(() => expect(saved).toHaveLength(1), { timeout: 5000 });
        expect(saved[0].method).toBe('POST');
        expect(saved[0].body.excludedStayDates).toEqual([{ from: '2026-11-25', to: '2026-11-25' }]);
    }, 30000);

    it('inclui a exceção digitada mesmo sem clicar em "Adicionar" e aceita intervalo', async () => {
        const saved = setupFetch();
        render(<PromocoesPage />);
        await openNewForm();

        fireEvent.change(screen.getByLabelText(/Nome da promoção/), { target: { value: 'Mobile 10%' } });
        fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-12-24' } });
        fireEvent.change(screen.getByLabelText('Até (opcional)'), { target: { value: '2026-12-26' } });
        fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

        await waitFor(() => expect(saved).toHaveLength(1), { timeout: 5000 });
        expect(saved[0].body.excludedStayDates).toEqual([{ from: '2026-12-24', to: '2026-12-26' }]);
    }, 30000);

    it('remove uma exceção antes de salvar e recusa data final antes da inicial', async () => {
        const saved = setupFetch();
        render(<PromocoesPage />);
        await openNewForm();

        fireEvent.change(screen.getByLabelText(/Nome da promoção/), { target: { value: 'Teste' } });
        fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-11-25' } });
        fireEvent.click(screen.getByRole('button', { name: 'Adicionar exceção' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Remover exceção 25/11/2026' }));
        expect(screen.queryByRole('button', { name: 'Remover exceção 25/11/2026' })).not.toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-11-26' } });
        fireEvent.change(screen.getByLabelText('Até (opcional)'), { target: { value: '2026-11-25' } });
        fireEvent.click(screen.getByRole('button', { name: 'Adicionar exceção' }));

        expect(await screen.findByText('A data final da exceção não pode ser antes da inicial.')).toBeInTheDocument();
        expect(saved).toHaveLength(0);
    }, 30000);
});

describe('Admin Promoções — calendário, dias da semana e resumo', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const setWindow = () => {
        fireEvent.change(screen.getByLabelText('Estadia a partir de'), { target: { value: '2099-11-01' } });
        fireEvent.change(screen.getByLabelText('Estadia até (última noite)'), { target: { value: '2099-11-30' } });
    };
    const day = (label: string) => screen.findByRole('button', { name: label }, { timeout: 5000 });

    it('clicar num dia do calendário remove a promoção dele; clicar de novo traz de volta', async () => {
        setupFetch();
        render(<PromocoesPage />);
        await openNewForm();
        setWindow();

        fireEvent.click(await day('25/11/2099: com desconto, clique para remover'));
        expect(await screen.findByRole('button', { name: 'Remover exceção 25/11/2099' })).toBeInTheDocument();
        expect(screen.getByTestId('promo-excluded-count')).toHaveTextContent('1 dia(s) removido(s)');

        fireEvent.click(await day('25/11/2099: removido, clique para voltar'));
        expect(screen.queryByRole('button', { name: 'Remover exceção 25/11/2099' })).not.toBeInTheDocument();
    }, 30000);

    it('dias vizinhos removidos viram um intervalo só e "Remover tudo" limpa a lista', async () => {
        setupFetch();
        render(<PromocoesPage />);
        await openNewForm();
        setWindow();

        fireEvent.click(await day('24/11/2099: com desconto, clique para remover'));
        fireEvent.click(await day('25/11/2099: com desconto, clique para remover'));
        expect(await screen.findByRole('button', { name: 'Remover exceção 24/11/2099 a 25/11/2099' })).toBeInTheDocument();
        expect(screen.getByTestId('promo-excluded-count')).toHaveTextContent('2 dia(s) removido(s)');

        fireEvent.click(screen.getByRole('button', { name: 'Remover tudo' }));
        expect(screen.queryByTestId('promo-excluded-count')).not.toBeInTheDocument();
    }, 30000);

    it('dias fora do período e dias da semana desmarcados ficam cinza e não podem ser clicados', async () => {
        setupFetch();
        render(<PromocoesPage />);
        await openNewForm();
        setWindow();

        // 2099-11-07 é sábado; 2099-11-08 é domingo
        expect(await day('07/11/2099: com desconto, clique para remover')).toBeEnabled();
        fireEvent.click(screen.getByLabelText('Sáb'));
        const saturday = await day('07/11/2099: dia da semana desmarcado');
        expect(saturday).toBeDisabled();
        expect(saturday).toHaveAttribute('data-state', 'weekdayOff');

        // depois do fim do período
        fireEvent.change(screen.getByLabelText('Estadia até (última noite)'), { target: { value: '2099-11-20' } });
        const outside = await day('25/11/2099: fora do período da promoção');
        expect(outside).toBeDisabled();
    }, 30000);

    it('o resumo em texto acompanha o período, os dias da semana e as exceções', async () => {
        setupFetch();
        render(<PromocoesPage />);
        await openNewForm();
        const summary = screen.getByTestId('promo-summary');
        expect(summary).toHaveTextContent('O desconto será aplicado em qualquer noite futura');

        setWindow();
        fireEvent.click(screen.getByLabelText('Sáb'));
        fireEvent.click(screen.getByLabelText('Dom'));
        fireEvent.click(await day('25/11/2099: com desconto, clique para remover'));

        await waitFor(() => expect(summary).toHaveTextContent('nas noites de 01/11/2099 a 30/11/2099'), { timeout: 5000 });
        expect(summary).toHaveTextContent('somente em: Seg, Ter, Qua, Qui, Sex');
        expect(summary).toHaveTextContent('exceto: 25/11/2099');
    }, 30000);

    it('envia os dias da semana e as exceções ao salvar, e não deixa salvar sem nenhum dia marcado', async () => {
        const saved = setupFetch();
        render(<PromocoesPage />);
        await openNewForm();
        fireEvent.change(screen.getByLabelText(/Nome da promoção/), { target: { value: 'Fim de semana' } });
        setWindow();
        fireEvent.click(await day('25/11/2099: com desconto, clique para remover'));
        for (const label of ['Seg', 'Ter', 'Qua', 'Qui']) fireEvent.click(screen.getByLabelText(label));

        fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
        await waitFor(() => expect(saved).toHaveLength(1), { timeout: 5000 });
        expect(saved[0].body.daysOfWeek).toEqual([0, 5, 6]);
        expect(saved[0].body.excludedStayDates).toEqual([{ from: '2099-11-25', to: '2099-11-25' }]);
        expect(saved[0].body.stayStart).toBe('2099-11-01');

        // desmarca tudo: o painel avisa e não envia
        await openNewForm();
        fireEvent.change(screen.getByLabelText(/Nome da promoção/), { target: { value: 'Sem dias' } });
        for (const label of ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']) fireEvent.click(screen.getByLabelText(label));
        fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
        expect(await screen.findByText('Marque ao menos um dia da semana.')).toBeInTheDocument();
        expect(saved).toHaveLength(1);
    }, 30000);

    it('mostra no cartão os dias da semana em que a promoção vale', async () => {
        setupFetch([{ ...basePromotion, excludedStayDates: null, daysOfWeek: '[5,6]' }]);
        render(<PromocoesPage />);
        expect(await screen.findByText(/Só em: Sex, Sáb/, undefined, { timeout: 5000 })).toBeInTheDocument();
    }, 30000);
});

describe('Admin Promoções — categoria Reserva direta', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('o cartão de uma promoção com etiqueta oculta mostra a categoria Reserva direta', async () => {
        setupFetch([{ ...basePromotion, name: 'Genius dinâmico', excludedStayDates: null, showBadge: false }]);
        render(<PromocoesPage />);

        expect(await screen.findByText('🏡 Reserva direta', undefined, { timeout: 5000 })).toBeInTheDocument();
        expect(screen.getByText(/Categoria Reserva direta: somada com as outras/)).toBeInTheDocument();
    }, 30000);

    it('promoção com etiqueta própria (padrão) não é marcada como Reserva direta', async () => {
        setupFetch([{ ...basePromotion, excludedStayDates: null, showBadge: true }]);
        render(<PromocoesPage />);

        expect(await screen.findByText(/Etiqueta: /, undefined, { timeout: 5000 })).toBeInTheDocument();
        expect(screen.queryByText('🏡 Reserva direta')).not.toBeInTheDocument();
    }, 30000);

    it('no formulário, escolher a categoria esconde o campo de etiqueta e envia showBadge falso', async () => {
        const saved = setupFetch();
        render(<PromocoesPage />);
        await openNewForm();

        // padrão: campanha com etiqueta própria (campo de etiqueta visível)
        expect(screen.getByRole('radio', { name: /Campanha com etiqueta própria/ })).toBeChecked();
        expect(screen.getByLabelText(/Etiqueta exibida ao hóspede/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('radio', { name: /Categoria Reserva direta/ }));
        expect(screen.getByRole('radio', { name: /Categoria Reserva direta/ })).toBeChecked();
        expect(screen.queryByLabelText(/Etiqueta exibida ao hóspede/)).not.toBeInTheDocument();

        fireEvent.change(screen.getByLabelText(/Nome da promoção/), { target: { value: 'Genius dinâmico' } });
        fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
        await waitFor(() => expect(saved).toHaveLength(1), { timeout: 5000 });
        expect(saved[0].body.showBadge).toBe(false);
    }, 30000);

    it('ao editar uma promoção da categoria, ela já abre marcada como Reserva direta', async () => {
        setupFetch([{ ...basePromotion, excludedStayDates: null, showBadge: false }]);
        render(<PromocoesPage />);
        fireEvent.click(await screen.findByRole('button', { name: 'Editar' }, { timeout: 5000 }));

        expect(await screen.findByRole('radio', { name: /Categoria Reserva direta/ })).toBeChecked();
    }, 30000);
});
