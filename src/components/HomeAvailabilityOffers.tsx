"use client";

import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, CalendarDays, Check, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
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

type OfferSearch = OfferWindow & {
  adults: number;
  children: number;
  childrenAges: number[];
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

function makeSearch(nights = 1): OfferSearch {
  const checkInDate = new Date();
  const checkOutDate = addDays(checkInDate, nights);

  return {
    checkIn: format(checkInDate, "yyyy-MM-dd"),
    checkOut: format(checkOutDate, "yyyy-MM-dd"),
    nights,
    adults: 2,
    children: 0,
    childrenAges: [],
  };
}

function calculateNights(checkIn: string, checkOut: string) {
  const start = new Date(`${checkIn}T12:00:00`);
  const end = new Date(`${checkOut}T12:00:00`);
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff);
}

function getNextDayKey(checkIn: string) {
  return format(addDays(new Date(`${checkIn}T12:00:00`), 1), "yyyy-MM-dd");
}

function makeOfferSearchKey(search: OfferSearch) {
  return [
    search.checkIn,
    search.checkOut,
    search.adults,
    search.children,
    search.childrenAges.slice(0, search.children).join(","),
  ].join("|");
}

function getOfferImage(room: HomeOffer) {
  const registeredPhoto = room.photos?.find((photo) => {
    const url = String(photo?.url || "").trim();
    return url && !url.includes("picsum.photos") && !url.includes("placeholder");
  })?.url;

  return registeredPhoto || getLocalRoomPhotos(room.name)?.[0] || null;
}

async function requestOffers(search: OfferSearch, signal: AbortSignal) {
  const params = new URLSearchParams({
    checkIn: search.checkIn,
    checkOut: search.checkOut,
    adults: String(search.adults),
    children: String(search.children),
  });
  if (search.children > 0) {
    params.set("childrenAges", search.childrenAges.slice(0, search.children).map((age) => String(age)).join(","));
  }
  const response = await fetch(`/api/availability?${params.toString()}`, {
    cache: "no-store",
    signal,
  });
  const data = await response.json().catch(() => null);

  return { response, data };
}

export default function HomeAvailabilityOffers({ onLowestOfferChange }: HomeAvailabilityOffersProps) {
  const initialSearch = useMemo(() => makeSearch(1), []);
  const [offerSearch, setOfferSearch] = useState(initialSearch);
  const [draftSearch, setDraftSearch] = useState(initialSearch);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [offers, setOffers] = useState<HomeOffer[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const lastLoadedSearchKeyRef = useRef("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadOffers() {
      const currentSearchKey = makeOfferSearchKey(offerSearch);
      if (lastLoadedSearchKeyRef.current === currentSearchKey) return;

      try {
        setOffers(null);
        setUnavailable(false);

        let nextSearch = offerSearch;
        let result = await requestOffers(nextSearch, controller.signal);

        if (!result.response.ok && result.data?.error === "min_stay_required") {
          const requiredNights = Math.max(1, Number(result.data.minLos) || 1);
          nextSearch = {
            ...nextSearch,
            checkOut: format(addDays(new Date(`${nextSearch.checkIn}T12:00:00`), requiredNights), "yyyy-MM-dd"),
            nights: requiredNights,
          };
          result = await requestOffers(nextSearch, controller.signal);
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

        lastLoadedSearchKeyRef.current = makeOfferSearchKey(nextSearch);
        setOfferSearch(nextSearch);
        setDraftSearch(nextSearch);
        setOffers(validOffers);
        setUnavailable(validOffers.length === 0);
        onLowestOfferChange?.(
          validOffers[0]
            ? {
                totalPrice: Number(validOffers[0].totalPrice),
                checkIn: nextSearch.checkIn,
                checkOut: nextSearch.checkOut,
                nights: nextSearch.nights,
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
  }, [offerSearch, onLowestOfferChange]);

  const resultUrl = `/reservar?${new URLSearchParams({
    checkIn: offerSearch.checkIn,
    checkOut: offerSearch.checkOut,
    adults: String(offerSearch.adults),
    children: String(offerSearch.children),
    ...(offerSearch.children > 0 ? { childrenAges: offerSearch.childrenAges.slice(0, offerSearch.children).map((age) => String(age)).join(",") } : {}),
  }).toString()}`;
  const dateLabel = `${format(new Date(`${offerSearch.checkIn}T12:00:00`), "dd MMM", { locale: ptBR })} – ${format(new Date(`${offerSearch.checkOut}T12:00:00`), "dd MMM yyyy", { locale: ptBR })}`;
  const guestLabel = `${offerSearch.adults} adulto${offerSearch.adults === 1 ? "" : "s"}${offerSearch.children > 0 ? ` e ${offerSearch.children} criança${offerSearch.children === 1 ? "" : "s"}` : ""}`;
  const canApplyDraft = Boolean(draftSearch.checkIn && draftSearch.checkOut)
    && new Date(`${draftSearch.checkOut}T12:00:00`) > new Date(`${draftSearch.checkIn}T12:00:00`)
    && draftSearch.adults >= 1
    && draftSearch.adults + draftSearch.children <= 4;

  const openSearchModal = () => {
    setDraftSearch(offerSearch);
    setIsSearchModalOpen(true);
  };

  const updateDraftCheckIn = (checkIn: string) => {
    if (!checkIn) {
      setDraftSearch((current) => ({ ...current, checkIn }));
      return;
    }

    setDraftSearch((current) => ({
      ...current,
      checkIn,
      checkOut: getNextDayKey(checkIn),
    }));
  };

  const updateDraftCheckOut = (checkOut: string) => {
    setDraftSearch((current) => {
      if (!current.checkIn || !checkOut) return { ...current, checkOut };

      const minimumCheckOut = getNextDayKey(current.checkIn);
      const normalizedCheckOut = new Date(`${checkOut}T12:00:00`) <= new Date(`${current.checkIn}T12:00:00`)
        ? minimumCheckOut
        : checkOut;

      return { ...current, checkOut: normalizedCheckOut };
    });
  };

  const updateDraftChildren = (children: number) => {
    const normalizedChildren = Math.min(Math.max(children, 0), Math.max(0, 4 - draftSearch.adults));
    setDraftSearch((current) => {
      const nextAges = current.childrenAges.slice(0, normalizedChildren);
      while (nextAges.length < normalizedChildren) nextAges.push(0);
      return { ...current, children: normalizedChildren, childrenAges: nextAges };
    });
  };

  const applyDraftSearch = () => {
    if (!canApplyDraft) return;
    setOfferSearch({
      ...draftSearch,
      nights: calculateNights(draftSearch.checkIn, draftSearch.checkOut),
      childrenAges: draftSearch.childrenAges.slice(0, draftSearch.children),
    });
    setIsSearchModalOpen(false);
  };

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
              Valores calculados pelo motor para {guestLabel}, de {dateLabel}. Altere as datas para consultar sua estadia.
            </p>
          </div>
          <button
            type="button"
            onClick={openSearchModal}
            className="inline-flex h-12 items-center justify-center gap-2 border border-primary/15 bg-white px-5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
          >
            Consultar outras datas <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {isSearchModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-8" role="dialog" aria-modal="true" aria-labelledby="home-offers-search-title">
            <div className="w-full max-w-2xl border border-primary/10 bg-white p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)] md:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-accent text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-gold)]">Nova consulta</p>
                  <h3 id="home-offers-search-title" className="mt-2 text-2xl font-semibold text-primary">Consultar outras datas</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Informe datas e ocupação para atualizar os valores dos cards.</p>
                </div>
                <button type="button" onClick={() => setIsSearchModalOpen(false)} className="text-2xl leading-none text-primary/65 hover:text-primary" aria-label="Fechar consulta">
                  ×
                </button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm font-semibold text-primary">
                  Check-in
                  <input
                    type="date"
                    value={draftSearch.checkIn}
                    min={format(new Date(), "yyyy-MM-dd")}
                    onChange={(event) => updateDraftCheckIn(event.target.value)}
                    className="h-12 w-full rounded-none border border-primary/15 bg-white px-3 font-medium text-foreground"
                  />
                </label>
                <label className="space-y-2 text-sm font-semibold text-primary">
                  Check-out
                  <input
                    type="date"
                    value={draftSearch.checkOut}
                    min={draftSearch.checkIn ? getNextDayKey(draftSearch.checkIn) : undefined}
                    onChange={(event) => updateDraftCheckOut(event.target.value)}
                    className="h-12 w-full rounded-none border border-primary/15 bg-white px-3 font-medium text-foreground"
                  />
                </label>
                <label className="space-y-2 text-sm font-semibold text-primary">
                  Adultos
                  <select
                    value={draftSearch.adults}
                    onChange={(event) => {
                      const adults = Number(event.target.value);
                      setDraftSearch((current) => {
                        const children = Math.min(current.children, Math.max(0, 4 - adults));
                        return { ...current, adults, children, childrenAges: current.childrenAges.slice(0, children) };
                      });
                    }}
                    className="h-12 w-full rounded-none border border-primary/15 bg-white px-3 font-medium text-foreground"
                  >
                    {[1, 2, 3, 4].map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
                <label className="space-y-2 text-sm font-semibold text-primary">
                  Crianças
                  <select
                    value={draftSearch.children}
                    onChange={(event) => updateDraftChildren(Number(event.target.value))}
                    className="h-12 w-full rounded-none border border-primary/15 bg-white px-3 font-medium text-foreground"
                  >
                    {Array.from({ length: Math.max(0, 4 - draftSearch.adults) + 1 }, (_, index) => (
                      <option key={index} value={index}>{index}</option>
                    ))}
                  </select>
                </label>
              </div>

              {draftSearch.children > 0 ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {draftSearch.childrenAges.slice(0, draftSearch.children).map((age, index) => (
                    <label key={index} className="space-y-2 text-sm font-semibold text-primary">
                      Idade da criança {index + 1}
                      <select
                        value={age}
                        onChange={(event) => {
                          const nextAge = Number(event.target.value);
                          setDraftSearch((current) => {
                            const nextAges = current.childrenAges.slice();
                            nextAges[index] = nextAge;
                            return { ...current, childrenAges: nextAges };
                          });
                        }}
                        className="h-12 w-full rounded-none border border-primary/15 bg-white px-3 font-medium text-foreground"
                      >
                        {Array.from({ length: 18 }, (_, value) => (
                          <option key={value} value={value}>{value} anos</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              ) : null}

              {!canApplyDraft ? (
                <p className="mt-4 text-sm text-destructive">Revise as datas e mantenha até 4 hóspedes por acomodação.</p>
              ) : null}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" className="rounded-none" onClick={() => setIsSearchModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="button" className="rounded-none" onClick={applyDraftSearch} disabled={!canApplyDraft}>
                  Atualizar valores
                </Button>
              </div>
            </div>
          </div>
        ) : null}

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
                      <p className="text-xs font-medium uppercase tracking-[0.12em]">Total para {offerSearch.nights} {offerSearch.nights === 1 ? "noite" : "noites"}</p>
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
