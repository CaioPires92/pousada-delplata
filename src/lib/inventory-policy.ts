export const HOSPEDIN_SAFETY_BUFFER = 1;

export function clampInventory(value: unknown, capacity: number) {
  const units = Number(value);
  return Math.max(0, Math.min(capacity, Number.isFinite(units) ? units : 0));
}

export function getAutomaticInventory(hospedinUnits: unknown, capacity: number) {
  return Math.max(0, clampInventory(hospedinUnits, capacity) - HOSPEDIN_SAFETY_BUFFER);
}

export function getEffectiveInventory(input: {
  hospedinUnits: unknown;
  manualOverrideUnits?: unknown | null;
  capacity: number;
}) {
  if (input.manualOverrideUnits !== null && input.manualOverrideUnits !== undefined) {
    return clampInventory(input.manualOverrideUnits, input.capacity);
  }
  return getAutomaticInventory(input.hospedinUnits, input.capacity);
}
