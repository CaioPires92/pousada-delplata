import { describe, expect, it } from "vitest";

import { isWithinQuietHours, moveAfterQuietHours } from "@/lib/crm/quietHours";

describe("CRM quiet hours", () => {
  it("uses America/Sao_Paulo across the overnight window", () => {
    expect(isWithinQuietHours({
      date: new Date("2026-08-11T01:30:00.000Z"), // 22:30 em São Paulo
      startHour: 20,
      endHour: 8,
    })).toBe(true);
    expect(isWithinQuietHours({
      date: new Date("2026-08-11T14:00:00.000Z"), // 11:00 em São Paulo
      startHour: 20,
      endHour: 8,
    })).toBe(false);
  });

  it("moves a nightly job to 08:00 in Sao Paulo", () => {
    expect(moveAfterQuietHours({
      date: new Date("2026-08-11T01:30:45.000Z"),
      startHour: 20,
      endHour: 8,
    }).toISOString()).toBe("2026-08-11T11:00:00.000Z");
  });

  it("keeps an already allowed time unchanged", () => {
    const allowed = new Date("2026-08-11T14:00:00.000Z");
    expect(moveAfterQuietHours({ date: allowed, startHour: 20, endHour: 8 }))
      .toEqual(allowed);
  });
});
