"use client";

import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, CalendarDays, Check, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getLocalRoomPhotos } from "@/lib/room-photos";

type HomeOffer = {
  id: string;
  name: string;
  description?: string | null;
  maxGuests?: number | null;
  capacity?: number | null;
  amenities?: string | null;
  totalPrice: number | string;
  photos?: Array<{ url?: string | null }>;
};

type OfferWindow = {
  checkIn: string;
  checkOut: string;
  nights: number;
};

export type HomeOfferSummary = {
  totalPrice: number;
  checkIn: string;
  checkOut: string;
  nights: number;
};

type HomeAvailabilityOffersProps = {
  onLowestOfferChange?: (summary: HomeOfferSummary | null) => void;
};

function formatBrl(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function makeWindow(nights = 1): OfferWindow {
  const checkInDate = new Date();
  const checkOutDate = addDays(checkInDate, nights);

  return {
    checkIn: format(checkInDate, "yyyy-MM-dd"),
    checkOut: format(checkOutDate, "yyyy-MM-dd"),
    nights,
  };
}

function getOfferImage(room: HomeOffer) {
  const registeredPhoto = room.photos?.find((photo) => {
    const url = String(photo?.url || "").trim();
    return url && !url.includes("picsum.photos") && !url.includes("placeholder");
  })?.url;

  return registeredPhoto || getLocalRoomPhotos(room.name)?.[0] || null;
}

async function requestOffers(window: OfferWindow, signal: AbortSignal) {
  const params = new URLSearchParams({
    checkIn: window.checkIn,
    checkOut: window.checkOut,
    adults: "2",
    children: "0",
  });
  const response = await fetch(`/api/availability?${params.toString()}`, {
    cache: "no-store",
    signal,
  });
  const data = await response.json().catch(() => null);

  return { response, data };
}

export default function HomeAvailabilityOffers({ onLowestOfferChange }: HomeAvailabilityOffersProps) {
  const initialWindow = useMemo(() => makeWindow(1), []);
  const [offerWindow, setOfferWindow] = useState(initialWindow);
  const [offers, setOffers] = useState<HomeOffer[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadOffers() {
      try {
        let nextWindow = initialWindow;
        let result = await requestOffers(nextWindow, controller.signal);

        if (!result.response.ok && result.data?.error === "min_stay_required") {
          const requiredNights = Math.max(1, Number(result.data.minLos) || 1);
          nextWindow = makeWindow(requiredNights);
          result = await requestOffers(nextWindow, controller.signal);
        }

        if (!result.response.ok || !Array.isArray(result.data)) {
          setOffers([]);
          setUnavailable(true);
          onLowestOfferChange?.(null);
          return;
        }

        const validOffers = result.data
          .filter((room: HomeOffer) => Number(room.totalPrice) > 0)
          .sort((left: HomeOffer, right: HomeOffer) => Number(left.totalPrice) - Number(right.totalPrice));

        setOfferWindow(nextWindow);
        setOffers(validOffers);
        setUnavailable(validOffers.length === 0);
        onLowestOfferChange?.(
          validOffers[0]
            ? {
                totalPrice: Number(validOffers[0].totalPrice),
                checkIn: nextWindow.checkIn,
                checkOut: nextWindow.checkOut,
                nights: nextWindow.nights,
              }
            : null,
        );
      } catch (error) {
        if ((error as Error)?.name === "AbortError") return;
        setOffers([]);
        setUnavailable(true);
        onLowestOfferChange?.(null);
      }
    }

    void loadOffers();
    return () => controller.abort();
  }, [initialWindow, onLowestOfferChange]);

  const resultUrl = `/reservar?${new URLSearchParams({
    checkIn: offerWindow.checkIn,
    checkOut: offerWindow.checkOut,
    adults: "2",
    children: "0",
  }).toString()}`;
  const dateLabel = `${format(new Date(`${offerWindow.checkIn}T12:00:00`), "dd MMM", { locale: ptBR })} – ${format(new Date(`${offerWindow.checkOut}T12:00:00`), "dd MMM yyyy", { locale: ptBR })}`;

  return (
    <section className="bg-[color:var(--brand-cream)] py-16 md:py-20" aria-labelledby="home-offers-title">
      <div className="container mx-auto max-w-[1440px] px-4">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="font-accent text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-gold)]">
              Disponibilidade real
            </p>
            <h2 id="home-offers-title" className="mt-3 font-hero-display text-[2.25rem] leading-[1.05] text-[#1d1b19] md:text-[3.1rem]">
              Escolha sua acomodação
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#1d1b19]/70 md:text-base">
              Valores calculados pelo motor para 2 adultos, de {dateLabel}. Altere as datas para consultar sua estadia.
            </p>
          </div>
          <Link
            href="/reservar"
            className="inline-flex h-12 items-center justify-center gap-2 border border-primary/15 bg-white px-5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
          >
            Consultar outras datas <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {offers === null ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4" aria-label="Carregando acomodações">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="animate-pulse border border-primary/10 bg-white">
                <div className="aspect-[4/3] bg-primary/10" />
                <div className="space-y-3 p-5">
                  <div className="h-6 w-2/3 bg-primary/10" />
                  <div className="h-4 w-full bg-primary/10" />
                  <div className="h-10 w-full bg-primary/10" />
                </div>
              </div>
            ))}
          </div>
        ) : unavailable ? (
          <div className="border border-primary/10 bg-white px-6 py-10 text-center md:px-10">
            <CalendarDays className="mx-auto h-9 w-9 text-[color:var(--brand-gold)]" />
            <h3 className="mt-4 text-xl font-semibold text-primary">Consulte as datas da sua viagem</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Não encontramos uma oferta para o período de referência. O motor pode consultar outras datas e a ocupação correta sem exibir um preço desatualizado.
            </p>
            <Link href="/reservar" className="mt-5 inline-flex h-12 items-center justify-center bg-primary px-6 text-sm font-semibold text-white">
              Ver preços e disponibilidade
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {offers.slice(0, 4).map((room) => {
              const image = getOfferImage(room);
              const amenities = String(room.amenities || "")
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean)
                .slice(0, 3);
              const maxGuests = Number(room.maxGuests || room.capacity || 0);
              const roomUrl = `${resultUrl}&roomTypeId=${encodeURIComponent(room.id)}`;

              return (
                <article key={room.id} className="group flex h-full flex-col overflow-hidden border border-primary/10 bg-white">
                  <div className="relative aspect-[4/3] overflow-hidden bg-primary/5">
                    {image ? (
                      <Image
                        src={image}
                        alt={room.name}
                        fill
                        sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 25vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.025]"
                      />
                    ) : null}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-4 pb-4 pt-10 text-white">
                      <p className="text-xs font-medium uppercase tracking-[0.12em]">Total para {offerWindow.nights} {offerWindow.nights === 1 ? "noite" : "noites"}</p>
                      <p className="mt-1 text-2xl font-bold">{formatBrl(Number(room.totalPrice))}</p>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="text-xl font-semibold leading-tight text-primary">{room.name}</h3>
                    {maxGuests > 0 ? (
                      <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" /> Até {maxGuests} hóspedes
                      </p>
                    ) : null}
                    {amenities.length > 0 ? (
                      <ul className="mt-4 space-y-2 text-sm text-foreground/75">
                        {amenities.map((amenity) => (
                          <li key={amenity} className="flex items-center gap-2">
                            <Check className="h-3.5 w-3.5 text-[color:var(--brand-gold)]" /> {amenity}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <Link
                      href={roomUrl}
                      className="mt-5 inline-flex h-11 items-center justify-center gap-2 bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
                    >
                      Escolher esta acomodação <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
