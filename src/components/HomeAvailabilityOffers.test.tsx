import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HomeAvailabilityOffers from "./HomeAvailabilityOffers";

const fetchMock = vi.fn();

describe("HomeAvailabilityOffers", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
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

    fireEvent.click(screen.getByRole("button", { name: /Abrir galeria de fotos de Chalé com fotos/i }));

    expect(screen.getByRole("dialog", { name: /Galeria de fotos de Chalé com fotos/i })).toBeInTheDocument();
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

      await waitFor(() => expect(screen.getByText("R$ 750,00")).toBeInTheDocument());
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining("checkIn=2026-08-10&checkOut=2026-08-12&adults=3&children=1&childrenAges=0"),
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
});
