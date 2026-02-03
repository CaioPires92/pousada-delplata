import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Calendar } from './calendar';

describe('Calendar', () => {
  it('renderiza DayPicker com navegação', () => {
    render(<Calendar showOutsideDays />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('mescla className customizada com classes padrão', () => {
    const { container } = render(<Calendar className="test-class" />);
    const root = container.querySelector('.rdp-grid7');
    expect(root).toBeTruthy();
    expect(root?.className).toMatch(/test-class/);
  });
});
