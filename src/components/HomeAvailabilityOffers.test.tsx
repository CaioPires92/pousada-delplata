import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { addDays, format } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomeAvailabilityOffers from "./HomeAvailabilityOffers";

const fetchMock = vi.fn();

describe("HomeAvailabilityOffers", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exibe somente preço e acomodação retornados pela disponibilidade", async () => {
    const onLowestOfferChange = vi.fn();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "room-1",
          name: "Apartamento Térreo",
          maxGuests: 4,
          amenities: "WiFi, Smart TV, Ar-condicionado",
          totalPrice: 599,
          photos: [],
        },
      ],
    });

    render(<HomeAvailabilityOffers onLowestOfferChange={onLowestOfferChange} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Apartamento Térreo" })).toBeInTheDocument();
    });

    expect(screen.getByText("R$ 599,00")).toBeInTheDocument();
    expect(screen.getByText(/Até 4 hóspedes/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Consultar outras datas/i }));
    expect(screen.getByRole("dialog", { name: /Consultar outras datas/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Escolher esta acomodação/i })).toHaveAttribute(
      "href",
      expect.stringContaining("roomTypeId=room-1"),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/availability?"),
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(onLowestOfferChange).toHaveBeenCalledWith(expect.objectContaining({ totalPrice: 599, nights: 1 }));
  });

  it("não inventa preço quando a disponibilidade falha", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "internal_error" }),
    });

    render(<HomeAvailabilityOffers />);

    await waitFor(() => {
      expect(screen.getByText(/Consulte as datas da sua viagem/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/R\$/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver preços e disponibilidade/i })).toHaveAttribute("href", "/reservar");
  });

  it("busca automaticamente a próxima data com oferta real no carregamento inicial", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: "next-room",
            name: "Chalé disponível",
            maxGuests: 4,
            amenities: "WiFi",
            totalPrice: 499,
            photos: [],
          },
        ],
      });

    render(<HomeAvailabilityOffers />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Chalé disponível" })).toBeInTheDocument();
    });

    expect(screen.getByText("R$ 499,00")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("link", { name: /Escolher esta acomodação/i })).toHaveAttribute(
      "href",
      expect.stringContaining("roomTypeId=next-room"),
    );
  });

  it("abre galeria de fotos ao clicar na foto da acomodação", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "room-gallery",
          name: "Chalé com fotos",
          maxGuests: 4,
          amenities: "WiFi",
          totalPrice: 699,
          photos: [
            { url: "/fotos/chale-1.webp" },
            { url: "/fotos/chale-2.webp" },
          ],
        },
      ],
    });

    render(<HomeAvailabilityOffers />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Chalé com fotos" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Ver fotos \(\d+\): Chalé com fotos/i }));

    expect(screen.getByRole("dialog", { name: /Foto ampliada: Chalé com fotos/i })).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Próxima foto/i }));

    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });

  it("atualiza os cards sozinho ao mudar datas e hóspedes no modal (sem botão aplicar)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-01T12:00:00"));
    try {
      const offer = (price: number) => ({
        ok: true,
        json: async () => [{ id: "room-1", name: "Chalé", maxGuests: 4, amenities: "WiFi", totalPrice: price, photos: [] }],
      });
      fetchMock.mockResolvedValueOnce(offer(499)).mockResolvedValueOnce(offer(750));

      render(<HomeAvailabilityOffers />);
      await waitFor(() => expect(screen.getByText("R$ 499,00")).toBeInTheDocument());

      fireEvent.click(screen.getByRole("button", { name: /Consultar outras datas/i }));

      // Check-in 10/08: o check-out vira 11/08 e o seletor do check-out abre sozinho.
      fireEvent.click(screen.getByRole("button", { name: "Check-in" }));
      fireEvent.click(await screen.findByRole("button", { name: /10 de agosto de 2026/i }));
      expect(screen.getByRole("button", { name: "Check-out" })).toHaveTextContent("11/08/2026");

      // Check-out 12/08, abrindo no mês do check-in (e não no de hoje).
      fireEvent.click(await screen.findByRole("button", { name: /12 de agosto de 2026/i }));
      expect(screen.getByRole("button", { name: "Check-out" })).toHaveTextContent("12/08/2026");

      fireEvent.click(screen.getByRole("button", { name: /Aumentar adultos/i }));
      fireEvent.click(screen.getByRole("button", { name: /Aumentar crianças/i }));
      // Sem idade escolhida a criança não entra na cotação.
      expect(screen.getByLabelText("Idade da criança 1")).toHaveValue("");
      fireEvent.change(screen.getByLabelText("Idade da criança 1"), { target: { value: "4" } });

      await waitFor(() => expect(screen.getByText("R$ 750,00")).toBeInTheDocument());
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining("checkIn=2026-08-10&checkOut=2026-08-12&adults=3&children=1&childrenAges=4"),
        expect.objectContaining({ cache: "no-store" }),
      );
      expect(screen.getByRole("link", { name: /Escolher esta acomodação/i })).toHaveAttribute("href", expect.stringContaining("adults=3"));
    } finally {
      vi.useRealTimers();
    }
  }, 15000);

  it("bloqueia dias passados no seletor de check-in e não dispara nova consulta ao clicar neles", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-15T12:00:00"));
    try {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => [{ id: "room-1", name: "Chalé", maxGuests: 4, amenities: "WiFi", totalPrice: 499, photos: [] }],
      });
      render(<HomeAvailabilityOffers />);
      await waitFor(() => expect(screen.getByText("R$ 499,00")).toBeInTheDocument());
      const callsBefore = fetchMock.mock.calls.length;

      fireEvent.click(screen.getByRole("button", { name: /Consultar outras datas/i }));
      fireEvent.click(screen.getByRole("button", { name: "Check-in" }));

      const past = await screen.findByRole("button", { name: /10 de agosto de 2026/i });
      expect(past).toBeDisabled();
      fireEvent.click(past);
      await new Promise((resolve) => setTimeout(resolve, 600));
      expect(fetchMock.mock.calls.length).toBe(callsBefore);
    } finally {
      vi.useRealTimers();
    }
  });

  it("avisa quando não há vaga na data inicial e mostra a primeira data disponível", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-11T12:00:00"));
    try {
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => [] }) // 11–12 sem vagas
        .mockResolvedValueOnce({ ok: true, json: async () => [] }) // 12–13 sem vagas
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: "room-1", name: "Chalé", maxGuests: 4, amenities: "WiFi", totalPrice: 480, photos: [] }],
        });

      render(<HomeAvailabilityOffers />);

      expect(await screen.findByText(/Sem vagas para 11–12 nov\. Mostrando a primeira data disponível: 13–14 nov\./i)).toBeInTheDocument();
      expect(screen.getByText("R$ 480,00")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("repete a consulta com a estadia mínima informada pelo motor", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "min_stay_required", minLos: 3 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: "room-3",
            name: "Chalé",
            maxGuests: 3,
            amenities: "WiFi",
            totalPrice: 1200,
            photos: [],
          },
        ],
      });

    render(<HomeAvailabilityOffers />);

    await waitFor(() => {
      expect(screen.getByText(/Total para 3 noites/i)).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status")).toHaveTextContent(/o mínimo de reservas é 3 noites\. Mostrando/i);
  });

  describe("quartos sem vaga na data (showSoldOutRooms)", () => {
    const terreo = { id: "terreo-id", name: "Apartamento Térreo", maxGuests: 4, capacity: 4, amenities: "TV, Ar-condicionado", totalPrice: 300 };
    const superior = { id: "superior-id", name: "Apartamento Superior", maxGuests: 4, capacity: 4, amenities: "TV", totalPrice: 392.44 };
    const chale = { id: "chale-id", name: "Chalé", maxGuests: 1, capacity: 1, amenities: "TV", totalPrice: 280 };
    const ok = (data: unknown) => ({ ok: true, json: async () => data });

    // Data fixa no meio do mês: o teste não pode depender do dia em que roda.
    const today = () => format(new Date(2026, 5, 10, 12), "yyyy-MM-dd");

    function mockApi(availableOn: (checkIn: string) => unknown[]) {
      fetchMock.mockImplementation(async (url: string) => {
        if (String(url).includes("/api/rooms")) return ok([terreo, superior, chale]);
        const checkIn = new URL(String(url), "http://localhost").searchParams.get("checkIn") ?? "";
        return ok(availableOn(checkIn));
      });
    }

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(2026, 5, 10, 12, 0, 0));
    });

    it("mostra o Térreo com a etiqueta 'Indisponível hoje' e a próxima data com vaga", async () => {
      const dayAfterTomorrow = format(addDays(new Date(), 2), "yyyy-MM-dd");
      // Hoje e amanhã só o Superior tem vaga; a partir de depois de amanhã o Térreo volta.
      mockApi((checkIn) => (checkIn >= dayAfterTomorrow ? [terreo, superior] : [superior]));

      render(<HomeAvailabilityOffers showSoldOutRooms />);

      expect(await screen.findByRole("heading", { name: "Apartamento Térreo" })).toBeInTheDocument();
      expect(screen.getByText("Indisponível hoje")).toBeInTheDocument();
      expect(await screen.findByText("Próxima data disponível")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Ver essa data/i })).toHaveAttribute(
        "href",
        expect.stringContaining(`checkIn=${dayAfterTomorrow}`),
      );
      expect(screen.getByRole("link", { name: /Ver essa data/i })).toHaveAttribute(
        "href",
        expect.stringContaining("roomTypeId=terreo-id"),
      );
      // O quarto com vaga continua com o botão normal de escolher, e o sem vaga não o tem.
      expect(screen.getAllByRole("link", { name: /Escolher esta acomodação/i })).toHaveLength(1);
      // O Térreo vem antes do Superior (ordem fixa dos quartos).
      const headings = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
      expect(headings.indexOf("Apartamento Térreo")).toBeLessThan(headings.indexOf("Apartamento Superior"));
    });

    it("avisa quando não há vaga nos próximos dias", async () => {
      mockApi(() => [superior]);

      render(<HomeAvailabilityOffers showSoldOutRooms />);

      expect(await screen.findByText(/Sem vaga nos próximos 30 dias/i)).toBeInTheDocument();
      expect(screen.getByText("Indisponível hoje")).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /Ver essa data/i })).not.toBeInTheDocument();
    });

    it("não lista quartos que não comportam o grupo de hóspedes (Chalé de 1 pessoa para 2 adultos)", async () => {
      mockApi(() => [superior]);

      render(<HomeAvailabilityOffers showSoldOutRooms />);

      await screen.findByText(/Sem vaga nos próximos 30 dias/i);
      expect(screen.queryByRole("heading", { name: "Chalé" })).not.toBeInTheDocument();
    });

    it("sem a opção, a home continua mostrando só o que a disponibilidade devolve e não consulta os quartos", async () => {
      mockApi(() => [superior]);

      render(<HomeAvailabilityOffers />);

      await screen.findByRole("heading", { name: "Apartamento Superior" });
      expect(screen.queryByRole("heading", { name: "Apartamento Térreo" })).not.toBeInTheDocument();
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/api/rooms"))).toBe(false);
      expect(today()).toBe("2026-06-10");
    });
  });
});
