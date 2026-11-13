"use client";

import { addDays, format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, CalendarDays, Camera, Check, ChevronLeft, ChevronRight, Users, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { DateField } from "@/components/booking-search/DateField";
import { GuestsPanel } from "@/components/booking-search/GuestsPanel";
import { Button } from "@/components/ui/button";
import { getLocalRoomPhotos } from "@/lib/room-photos";
import { fromDayKey, minStayMessage, toDayKey, validateBookingSearch } from "@/lib/booking-search";

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
  pets: number;
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

type RoomGalleryState = {
  roomName: string;
  photos: string[];
  currentIndex: number;
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
    pets: 0,
  };
}

/** "20–21 nov" ou "30 out – 02 nov" (para os avisos ao hóspede). */
function formatShortRange(checkIn: string, checkOut: string) {
  const start = fromDayKey(checkIn);
  const end = fromDayKey(checkOut);
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${format(start, "dd")}–${format(end, "dd MMM", { locale: ptBR })}`;
  }
  return `${format(start, "dd MMM", { locale: ptBR })} – ${format(end, "dd MMM", { locale: ptBR })}`;
}

function calculateNights(checkIn: string, checkOut: string) {
  const start = new Date(`${checkIn}T12:00:00`);
  const end = new Date(`${checkOut}T12:00:00`);
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff);
}

function makeOfferSearchKey(search: OfferSearch) {
  return [
    search.checkIn,
    search.checkOut,
    search.adults,
    search.children,
    search.childrenAges.slice(0, search.children).join(","),
    search.pets,
  ].join("|");
}

function moveSearchByDays(search: OfferSearch, offsetDays: number): OfferSearch {
  const checkInDate = addDays(new Date(`${search.checkIn}T12:00:00`), offsetDays);
  const checkOutDate = addDays(checkInDate, search.nights);

  return {
    ...search,
    checkIn: format(checkInDate, "yyyy-MM-dd"),
    checkOut: format(checkOutDate, "yyyy-MM-dd"),
  };
}

function isValidOfferPhotoUrl(url: string) {
  const normalizedUrl = url.trim();
  return normalizedUrl && !normalizedUrl.includes("picsum.photos") && !normalizedUrl.includes("placeholder");
}

function getOfferPhotos(room: HomeOffer) {
  const registeredPhotos = (room.photos ?? [])
    .map((photo) => String(photo?.url || "").trim())
    .filter(isValidOfferPhotoUrl);

  if (registeredPhotos.length > 0) return registeredPhotos;

  return getLocalRoomPhotos(room.name) ?? [];
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
  if (search.pets > 0) params.set("pets", String(search.pets));
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
  const [roomGallery, setRoomGallery] = useState<RoomGalleryState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openPicker, setOpenPicker] = useState<"checkIn" | "checkOut" | null>(null);
  const lastLoadedSearchKeyRef = useRef("");
  const initialFallbackAppliedRef = useRef(false);

  useEffect(() => {
    if (!roomGallery) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setRoomGallery(null);
      if (event.key === "ArrowRight") {
        setRoomGallery((current) => current ? { ...current, currentIndex: (current.currentIndex + 1) % current.photos.length } : current);
      }
      if (event.key === "ArrowLeft") {
        setRoomGallery((current) => current ? { ...current, currentIndex: (current.currentIndex - 1 + current.photos.length) % current.photos.length } : current);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [roomGallery]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadOffers() {
      const requestedSearch = offerSearch;
      const currentSearchKey = makeOfferSearchKey(requestedSearch);
      if (lastLoadedSearchKeyRef.current === currentSearchKey) return;

      try {
        setOffers(null);
        setUnavailable(false);

        let nextSearch = offerSearch;
        let nextNotice: string | null = null;
        let result = await requestOffers(nextSearch, controller.signal);

        if (!result.response.ok && result.data?.error === "min_stay_required") {
          const requiredNights = Math.max(1, Number(result.data.minLos) || 1);
          nextSearch = {
            ...nextSearch,
            checkOut: format(addDays(new Date(`${nextSearch.checkIn}T12:00:00`), requiredNights), "yyyy-MM-dd"),
            nights: requiredNights,
          };
          nextNotice = `${minStayMessage(requiredNights)} Mostrando ${formatShortRange(nextSearch.checkIn, nextSearch.checkOut)}.`;
          result = await requestOffers(nextSearch, controller.signal);
        }

        if (!result.response.ok || !Array.isArray(result.data)) {
          setOffers([]);
          setUnavailable(true);
          onLowestOfferChange?.(null);
          return;
        }

        let validOffers = result.data
          .filter((room: HomeOffer) => Number(room.totalPrice) > 0)
          .sort((left: HomeOffer, right: HomeOffer) => Number(left.totalPrice) - Number(right.totalPrice));

        const canTryInitialFallback = !initialFallbackAppliedRef.current
          && makeOfferSearchKey(offerSearch) === makeOfferSearchKey(initialSearch)
          && validOffers.length === 0;

        if (canTryInitialFallback) {
          initialFallbackAppliedRef.current = true;

          for (let offsetDays = 1; offsetDays <= 30; offsetDays += 1) {
            if (controller.signal.aborted) return;

            const fallbackSearch = moveSearchByDays(offerSearch, offsetDays);
            const fallbackResult = await requestOffers(fallbackSearch, controller.signal);

            if (!fallbackResult.response.ok || !Array.isArray(fallbackResult.data)) continue;

            const fallbackOffers = fallbackResult.data
              .filter((room: HomeOffer) => Number(room.totalPrice) > 0)
              .sort((left: HomeOffer, right: HomeOffer) => Number(left.totalPrice) - Number(right.totalPrice));

            if (fallbackOffers.length > 0) {
              nextNotice = `Sem vagas para ${formatShortRange(offerSearch.checkIn, offerSearch.checkOut)}. Mostrando a primeira data disponível: ${formatShortRange(fallbackSearch.checkIn, fallbackSearch.checkOut)}.`;
              nextSearch = fallbackSearch;
              validOffers = fallbackOffers;
              break;
            }
          }
        }

        lastLoadedSearchKeyRef.current = makeOfferSearchKey(nextSearch);
        setOfferSearch(nextSearch);
        // Não sobrescreve o que o hóspede já está editando no modal enquanto a consulta carregava.
        const requestedKey = makeOfferSearchKey(requestedSearch);
        setDraftSearch((current) => (makeOfferSearchKey(current) === requestedKey ? nextSearch : current));
        setNotice(nextNotice);
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
  }, [initialSearch, offerSearch, onLowestOfferChange]);

  const resultUrl = `/reservar?${new URLSearchParams({
    checkIn: offerSearch.checkIn,
    checkOut: offerSearch.checkOut,
    adults: String(offerSearch.adults),
    children: String(offerSearch.children),
    ...(offerSearch.children > 0 ? { childrenAges: offerSearch.childrenAges.slice(0, offerSearch.children).map((age) => String(age)).join(",") } : {}),
  }).toString()}`;
  const dateLabel = `${format(new Date(`${offerSearch.checkIn}T12:00:00`), "dd MMM", { locale: ptBR })} – ${format(new Date(`${offerSearch.checkOut}T12:00:00`), "dd MMM yyyy", { locale: ptBR })}`;
  const guestLabel = `${offerSearch.adults} adulto${offerSearch.adults === 1 ? "" : "s"}${offerSearch.children > 0 ? ` e ${offerSearch.children} criança${offerSearch.children === 1 ? "" : "s"}` : ""}`;
  const draftValidation = validateBookingSearch(draftSearch);
  const canApplyDraft = draftValidation.ok;

  const openSearchModal = () => {
    setDraftSearch(offerSearch);
    setIsSearchModalOpen(true);
  };

  const updateDraftCheckIn = (date: Date | undefined) => {
    if (!date) return;
    const checkIn = toDayKey(date);
    setDraftSearch((current) => ({ ...current, checkIn, checkOut: toDayKey(addDays(date, 1)) }));
    setOpenPicker("checkOut");
  };

  const updateDraftCheckOut = (date: Date | undefined) => {
    if (!date) return;
    setDraftSearch((current) => ({ ...current, checkOut: toDayKey(date) }));
    setOpenPicker(null);
  };

  // Atualiza os cards sozinho assim que datas/hóspedes do modal ficam válidos (sem botão "aplicar").
  useEffect(() => {
    if (!isSearchModalOpen || !canApplyDraft) return;
    if (makeOfferSearchKey(draftSearch) === makeOfferSearchKey(offerSearch)) return;

    const timeoutId = window.setTimeout(() => {
      setNotice(null);
      setOfferSearch({
        ...draftSearch,
        nights: calculateNights(draftSearch.checkIn, draftSearch.checkOut),
        childrenAges: draftSearch.childrenAges.slice(0, draftSearch.children),
      });
    }, 400);
    return () => window.clearTimeout(timeoutId);
  }, [canApplyDraft, draftSearch, isSearchModalOpen, offerSearch]);

  const openRoomGallery = (room: HomeOffer) => {
    const photos = getOfferPhotos(room);
    if (photos.length === 0) return;
    setRoomGallery({ roomName: room.name, photos, currentIndex: 0 });
  };

  const showPreviousGalleryPhoto = () => {
    setRoomGallery((current) => current ? { ...current, currentIndex: (current.currentIndex - 1 + current.photos.length) % current.photos.length } : current);
  };

  const showNextGalleryPhoto = () => {
    setRoomGallery((current) => current ? { ...current, currentIndex: (current.currentIndex + 1) % current.photos.length } : current);
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
            {notice ? (
              <p role="status" className="mt-3 inline-block max-w-2xl border border-brand-gold/40 bg-brand-gold/15 px-3 py-2 text-sm font-medium text-brand-brown-dark">
                {notice}
              </p>
            ) : null}
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
                <div className="space-y-2 text-sm font-semibold text-brand-brown-dark">
                  <span id="home-search-checkin">Check-in</span>
                  <DateField
                    value={fromDayKey(draftSearch.checkIn)}
                    onSelect={updateDraftCheckIn}
                    open={openPicker === "checkIn"}
                    onOpenChange={(open) => setOpenPicker(open ? "checkIn" : null)}
                    disabled={{ before: startOfDay(new Date()) }}
                    contentClassName="z-[70] w-auto p-0"
                    trigger={
                      <button type="button" aria-labelledby="home-search-checkin" className="h-12 w-full rounded-none border border-brand-brown-dark/15 bg-white px-3 text-left font-medium text-foreground">
                        {format(fromDayKey(draftSearch.checkIn), "dd/MM/yyyy", { locale: ptBR })}
                      </button>
                    }
                  />
                </div>
                <div className="space-y-2 text-sm font-semibold text-brand-brown-dark">
                  <span id="home-search-checkout">Check-out</span>
                  <DateField
                    value={fromDayKey(draftSearch.checkOut)}
                    openMonth={fromDayKey(draftSearch.checkIn)}
                    onSelect={updateDraftCheckOut}
                    open={openPicker === "checkOut"}
                    onOpenChange={(open) => setOpenPicker(open ? "checkOut" : null)}
                    disabled={{ before: addDays(fromDayKey(draftSearch.checkIn), 1) }}
                    contentClassName="z-[70] w-auto p-0"
                    trigger={
                      <button type="button" aria-labelledby="home-search-checkout" className="h-12 w-full rounded-none border border-brand-brown-dark/15 bg-white px-3 text-left font-medium text-foreground">
                        {format(fromDayKey(draftSearch.checkOut), "dd/MM/yyyy", { locale: ptBR })}
                      </button>
                    }
                  />
                </div>
              </div>

              <GuestsPanel
                className="mt-6"
                tone="light"
                value={{ adults: draftSearch.adults, children: draftSearch.children, childrenAges: draftSearch.childrenAges, pets: draftSearch.pets }}
                onChange={(next) =>
                  setDraftSearch((current) => ({
                    ...current,
                    adults: next.adults,
                    children: next.children,
                    childrenAges: next.childrenAges.map((age) => age ?? 0),
                    pets: next.pets,
                  }))
                }
                guestsError={!draftValidation.ok && draftValidation.field === "guests" ? draftValidation.message : undefined}
                agesError={!draftValidation.ok && draftValidation.field === "childrenAges" ? draftValidation.message : undefined}
              />

              {!draftValidation.ok && draftValidation.field === "dates" ? (
                <p role="alert" className="mt-4 text-sm text-destructive">{draftValidation.message}</p>
              ) : null}

              <div className="mt-6 flex justify-end">
                <Button type="button" className="rounded-none" onClick={() => setIsSearchModalOpen(false)}>
                  Concluir
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
              const photos = getOfferPhotos(room);
              const image = photos[0] ?? null;
              const canOpenGallery = photos.length > 0;
              const amenities = String(room.amenities || "")
                .split(/[;,]/)
                .map((item) => item.trim())
                .filter(Boolean)
                .slice(0, 3);
              const maxGuests = Number(room.maxGuests || room.capacity || 0);
              const roomUrl = `${resultUrl}&roomTypeId=${encodeURIComponent(room.id)}`;

              return (
                <article key={room.id} className="group flex h-full flex-col overflow-hidden border border-primary/10 bg-white">
                  <div
                    className={`relative aspect-[4/3] overflow-hidden bg-primary/5 ${canOpenGallery ? "cursor-zoom-in" : ""}`}
                    role={canOpenGallery ? "button" : undefined}
                    tabIndex={canOpenGallery ? 0 : undefined}
                    aria-label={canOpenGallery ? `Abrir galeria de fotos de ${room.name}` : undefined}
                    onClick={canOpenGallery ? () => openRoomGallery(room) : undefined}
                    onKeyDown={canOpenGallery ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openRoomGallery(room);
                      }
                    } : undefined}
                  >
                    {image ? (
                      <Image
                        src={image}
                        alt={room.name}
                        fill
                        sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 25vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.025]"
                      />
                    ) : null}
                    {canOpenGallery ? (
                      <div className="absolute left-4 top-4 inline-flex items-center gap-2 bg-black/58 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm">
                        <Camera className="h-3.5 w-3.5" />
                        Ver fotos ({photos.length})
                      </div>
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
        {roomGallery ? (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label={`Galeria de fotos de ${roomGallery.roomName}`}
            onClick={() => setRoomGallery(null)}
          >
            <button
              type="button"
              onClick={() => setRoomGallery(null)}
              className="absolute right-4 top-4 p-2 text-white/80 transition-colors hover:text-white"
              aria-label="Fechar galeria"
            >
              <X className="h-7 w-7" />
            </button>
            <div className="relative h-[82vh] w-full max-w-6xl" onClick={(event) => event.stopPropagation()}>
              <Image
                src={roomGallery.photos[roomGallery.currentIndex]}
                alt={`${roomGallery.roomName} foto ${roomGallery.currentIndex + 1}`}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 85vw"
              />
              {roomGallery.photos.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={showPreviousGalleryPhoto}
                    className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-lg bg-black/50 p-3 text-white hover:bg-black/70"
                    aria-label="Foto anterior"
                  >
                    <ChevronLeft className="h-7 w-7" />
                  </button>
                  <button
                    type="button"
                    onClick={showNextGalleryPhoto}
                    className="absolute right-0 top-1/2 -translate-y-1/2 rounded-l-lg bg-black/50 p-3 text-white hover:bg-black/70"
                    aria-label="Próxima foto"
                  >
                    <ChevronRight className="h-7 w-7" />
                  </button>
                </>
              ) : null}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-4 py-2 text-sm font-medium text-white">
                {roomGallery.currentIndex + 1} / {roomGallery.photos.length}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
