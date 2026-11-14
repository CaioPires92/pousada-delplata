import { describe, expect, it } from 'vitest';

import { getAutomaticInventory, getEffectiveInventory } from './inventory-policy';

describe('Hospedin inventory policy', () => {
  it('keeps one unit as a safety buffer', () => {
    expect(getAutomaticInventory(6, 6)).toBe(5);
    expect(getAutomaticInventory(2, 2)).toBe(1);
    expect(getAutomaticInventory(1, 2)).toBe(0);
    expect(getAutomaticInventory(0, 2)).toBe(0);
  });

  it('preserves a manual override across Hospedin changes', () => {
    expect(getEffectiveInventory({ hospedinUnits: 6, manualOverrideUnits: 2, capacity: 6 })).toBe(2);
    expect(getEffectiveInventory({ hospedinUnits: 1, manualOverrideUnits: 2, capacity: 6 })).toBe(2);
  });

  it('never exceeds physical room capacity', () => {
    expect(getEffectiveInventory({ hospedinUnits: 10, capacity: 4 })).toBe(3);
    expect(getEffectiveInventory({ hospedinUnits: 2, manualOverrideUnits: 10, capacity: 4 })).toBe(4);
  });
});
