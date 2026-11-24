import { describe, expect, it } from "vitest";

import { AGENDA_ITEMS, type AgendaItem } from "@/data/agenda-serra-negra";
import { getUpcomingAgenda } from "./BlogAgenda";

const item = (id: string, date: string): AgendaItem => ({
  id,
  title: id,
  date,
  sourceName: "Fonte",
  sourceUrl: "https://example.com/" + id,
});

describe("agenda de Serra Negra", () => {
  it("esconde eventos passados, ordena por data e respeita o limite", () => {
    const items = [item("c", "2026-12-20"), item("a", "2026-11-01"), item("b", "2026-12-05"), item("d", "2026-12-25")];
    const upcoming = getUpcomingAgenda("2026-12-05", 2, items);
    expect(upcoming.map((entry) => entry.id)).toEqual(["b", "c"]); // "a" já passou; o limite corta "d"
  });

  it("o evento do dia ainda aparece no próprio dia", () => {
    expect(getUpcomingAgenda("2026-12-05", 6, [item("hoje", "2026-12-05")]).map((entry) => entry.id)).toEqual(["hoje"]);
  });

  it("todo item da agenda tem data válida e fonte pública com link", () => {
    const ids = new Set<string>();
    for (const entry of AGENDA_ITEMS) {
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(new Date(`${entry.date}T00:00:00Z`).getTime())).toBe(false);
      expect(entry.sourceUrl).toMatch(/^https:\/\//);
      expect(entry.sourceName.length).toBeGreaterThan(0);
      expect(ids.has(entry.id)).toBe(false); // sem ids repetidos
      ids.add(entry.id);
    }
  });

  it("itens vindos só da imprensa (paradas de Natal) ficam marcados para confirmar", () => {
    const paradas = AGENDA_ITEMS.filter((entry) => entry.id.startsWith("parada-natal-"));
    expect(paradas).toHaveLength(6);
    expect(paradas.every((entry) => entry.confirm === true)).toBe(true);
  });
});
