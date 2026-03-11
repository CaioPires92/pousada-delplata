import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import InventoryStepper from './inventory-stepper';

describe('InventoryStepper', () => {
    it('increments and decrements through buttons', () => {
        const onIncrement = vi.fn();
        const onDecrement = vi.fn();

        render(
            <InventoryStepper
                value={2}
                maxValue={8}
                className="test-stepper"
                decrementLabel="menos"
                incrementLabel="mais"
                onIncrement={onIncrement}
                onDecrement={onDecrement}
                onCommit={vi.fn()}
                onInvalid={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'mais' }));
        fireEvent.click(screen.getByRole('button', { name: 'menos' }));

        expect(onIncrement).toHaveBeenCalledTimes(1);
        expect(onDecrement).toHaveBeenCalledTimes(1);
    });

    it('allows direct editing and confirms on enter', () => {
        const onCommit = vi.fn();

        render(
            <InventoryStepper
                value={2}
                maxValue={8}
                className="test-stepper"
                decrementLabel="menos"
                incrementLabel="mais"
                onIncrement={vi.fn()}
                onDecrement={vi.fn()}
                onCommit={onCommit}
                onInvalid={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /editar quartos disponíveis/i }));
        const input = screen.getByRole('spinbutton', { name: /editar quartos disponíveis/i });
        fireEvent.change(input, { target: { value: '5' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(onCommit).toHaveBeenCalledWith(5);
    });

    it('cancels direct editing on escape', () => {
        const onCommit = vi.fn();

        render(
            <InventoryStepper
                value={2}
                maxValue={8}
                className="test-stepper"
                decrementLabel="menos"
                incrementLabel="mais"
                onIncrement={vi.fn()}
                onDecrement={vi.fn()}
                onCommit={onCommit}
                onInvalid={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /editar quartos disponíveis/i }));
        const input = screen.getByRole('spinbutton', { name: /editar quartos disponíveis/i });
        fireEvent.change(input, { target: { value: '4' } });
        fireEvent.keyDown(input, { key: 'Escape' });

        expect(onCommit).not.toHaveBeenCalled();
    });

    it('blocks invalid values on blur', () => {
        const onInvalid = vi.fn();

        render(
            <InventoryStepper
                value={2}
                maxValue={8}
                className="test-stepper"
                decrementLabel="menos"
                incrementLabel="mais"
                onIncrement={vi.fn()}
                onDecrement={vi.fn()}
                onCommit={vi.fn()}
                onInvalid={onInvalid}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /editar quartos disponíveis/i }));
        const input = screen.getByRole('spinbutton', { name: /editar quartos disponíveis/i });
        fireEvent.change(input, { target: { value: '99' } });
        fireEvent.blur(input);

        expect(onInvalid).toHaveBeenCalledWith('O valor máximo permitido é 8.');
    });
});
