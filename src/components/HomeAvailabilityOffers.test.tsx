import { render, screen, waitFor } from "@testing-library/react";
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
    expect(screen.getByRole("link", { name: /Consultar outras datas/i })).toHaveAttribute("href", "/reservar");
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
  });
});
