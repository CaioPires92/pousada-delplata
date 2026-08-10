import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminNavbar from './AdminNavbar';

const navigationMocks = vi.hoisted(() => ({
    pathname: '/admin/pipeline',
    push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    usePathname: () => navigationMocks.pathname,
    useRouter: () => ({ push: navigationMocks.push }),
}));

describe('AdminNavbar', () => {
    beforeEach(() => {
        navigationMocks.push.mockClear();
    });

    it('groups every existing destination without changing its route', () => {
        render(<AdminNavbar />);

        expect(screen.getByText('Visão geral')).toBeInTheDocument();
        expect(screen.getByText('Operação')).toBeInTheDocument();
        expect(screen.getByText('Financeiro')).toBeInTheDocument();
        expect(screen.getByText('Atendimento e CRM')).toBeInTheDocument();

        expect(screen.getByRole('link', { name: 'Caixa de Entrada' })).toHaveAttribute('href', '/admin/inbox');
        expect(screen.getByRole('link', { name: 'Kanban de Vendas' })).toHaveAttribute('href', '/admin/pipeline');
        expect(screen.getByRole('link', { name: 'Chatbot e IA' })).toHaveAttribute('href', '/admin/settings/chatbot');
        expect(screen.getByRole('link', { name: 'Fila de Automação' })).toHaveAttribute('href', '/admin/automation-jobs');
        expect(screen.getAllByRole('link')).toHaveLength(13);
    });

    it('uses tooltips and hides section headings when collapsed', () => {
        render(<AdminNavbar isCollapsed />);

        expect(screen.queryByText('Atendimento e CRM')).not.toBeInTheDocument();
        expect(screen.getByTitle('Caixa de Entrada')).toHaveAttribute('href', '/admin/inbox');
        expect(screen.getByTitle('Kanban de Vendas')).toHaveAttribute('href', '/admin/pipeline');
        expect(screen.getByTitle('Chatbot e IA')).toHaveAttribute('href', '/admin/settings/chatbot');
        expect(screen.getByTitle('Fila de Automação')).toHaveAttribute('href', '/admin/automation-jobs');
    });
});
