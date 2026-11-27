"use client";

import homeStyles from "@/components/home-novo/home-novo.module.css";
import { addDays, format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, CalendarDays, Camera, Check, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { DateField } from "@/components/booking-search/DateField";
import { GuestsPanel } from "@/components/booking-search/GuestsPanel";
import { Button } from "@/components/ui/button";
import { type GalleryPhoto, PhotoLightbox } from "@/components/home-novo/PhotoLightbox";
import { buildRoomGalleryPhotos } from "@/lib/room-gallery";
import { getLocalRoomPhotos } from "@/lib/room-photos";
import { roomAcceptsPets } from "@/lib/pet-policy";
import { sortRoomsForDisplay } from "@/lib/rooms";
import { fromDayKey, minStayMessage, toDayKey, validateBookingSearch, type ChildAge } from "@/lib/booking-search";

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

/** Quarto sem vaga na data da busca: aparece no painel com a próxima data em que há vaga. */
type SoldOutInfo =
  | { status: "searching" }
  | { status: "found"; search: { checkIn: string; checkOut: string; nights: number }; totalPrice: number }
  | { status: "none" };

type PanelRoom = HomeOffer & { soldOut?: SoldOutInfo };

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
  /** Mostra também os quartos sem vaga na data, com aviso e a próxima data disponível. */
  showSoldOutRooms?: boolean;
};

type RoomGalleryState = {
  roomName: string;
  photos: GalleryPhoto[];
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

function makeOfferSearchKey(search: Omit<OfferSearch, "childrenAges"> & { childrenAges: ChildAge[] }) {
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

// Quantos dias à frente procurar a próxima vaga de um quarto sem disponibilidade, e quantas datas consultar por vez.
const NEXT_AVAILABLE_WINDOW_DAYS = 30;
const NEXT_AVAILABLE_BATCH = 5;

/** Procura, data a data, a primeira vez em que cada quarto da lista volta a aparecer na disponibilidade. */
async function findNextAvailability(base: OfferSearch, roomIds: string[], signal: AbortSignal) {
  const found = new Map<string, { search: OfferSearch; totalPrice: number }>();

  for (let start = 1; start <= NEXT_AVAILABLE_WINDOW_DAYS && found.size < roomIds.length; start += NEXT_AVAILABLE_BATCH) {
    const offsets = Array.from(
      { length: Math.min(NEXT_AVAILABLE_BATCH, NEXT_AVAILABLE_WINDOW_DAYS - start + 1) },
      (_, index) => start + index,
    );
    const results = await Promise.all(
      offsets.map(async (offset) => {
        const search = moveSearchByDays(base, offset);
        try {
          const result = await requestOffers(search, signal);
          return { search, data: result.response.ok && Array.isArray(result.data) ? (result.data as HomeOffer[]) : [] };
        } catch (error) {
          if ((error as Error)?.name === "AbortError") throw error;
          return { search, data: [] as HomeOffer[] };
        }
      }),
    );

    // Os resultados vêm na ordem das datas: a primeira que traz o quarto é a próxima com vaga.
    for (const { search, data } of results) {
      for (const room of data) {
        if (roomIds.includes(room.id) && !found.has(room.id) && Number(room.totalPrice) > 0) {
          found.set(room.id, { search, totalPrice: Number(room.totalPrice) });
        }
      }
    }
  }

  return found;
}

// No modal a idade começa vazia: a criança só entra na cotação depois que o hóspede escolhe a idade.
type DraftSearch = Omit<OfferSearch, "childrenAges"> & { childrenAges: ChildAge[] };

export default function HomeAvailabilityOffers({ onLowestOfferChange, showSoldOutRooms = false }: HomeAvailabilityOffersProps) {
  const initialSearch = useMemo(() => makeSearch(1), []);
  const [offerSearch, setOfferSearch] = useState(initialSearch);
  const [draftSearch, setDraftSearch] = useState<DraftSearch>(initialSearch);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [offers, setOffers] = useState<HomeOffer[] | null>(null);
  const [soldOutRooms, setSoldOutRooms] = useState<PanelRoom[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [roomGallery, setRoomGallery] = useState<RoomGalleryState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openPicker, setOpenPicker] = useState<"checkIn" | "checkOut" | null>(null);
  const [activePanel, setActivePanel] = useState(0);
  const [panelTouched, setPanelTouched] = useState(false);
  const lastLoadedSearchKeyRef = useRef("");
  const initialFallbackAppliedRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadOffers() {
      const requestedSearch = offerSearch;
      const currentSearchKey = makeOfferSearchKey(requestedSearch);
      if (lastLoadedSearchKeyRef.current === currentSearchKey) return;

      try {
        setOffers(null);
        setSoldOutRooms([]);
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

        if (showSoldOutRooms && validOffers.length > 0) {
          void loadSoldOutRooms(nextSearch, validOffers, controller.signal);
        }
      } catch (error) {
        if ((error as Error)?.name === "AbortError") return;
        setOffers([]);
        setUnavailable(true);
        onLowestOfferChange?.(null);
      }
    }

    // Quartos que existem mas não voltaram na disponibilidade desta data (e que cabem no grupo de hóspedes).
    async function loadSoldOutRooms(search: OfferSearch, available: HomeOffer[], signal: AbortSignal) {
      try {
        const response = await fetch("/api/rooms", { cache: "no-store", signal });
        const rooms = response?.ok ? await response.json().catch(() => null) : null;
        if (!Array.isArray(rooms)) return;

        const availableIds = new Set(available.map((room) => room.id));
        const guests = search.adults + search.children;
        const missing: HomeOffer[] = rooms
          .filter((room: HomeOffer) => room?.id && room?.name && !availableIds.has(room.id))
          .filter((room: HomeOffer) => {
            const capacity = Number(room.maxGuests || room.capacity || 0);
            return capacity === 0 || capacity >= guests;
          })
          .filter((room: HomeOffer) => search.pets === 0 || roomAcceptsPets(room.name))
          .map((room: HomeOffer) => ({ ...room, totalPrice: 0 }));
        if (missing.length === 0) return;

        setSoldOutRooms(missing.map((room) => ({ ...room, soldOut: { status: "searching" as const } })));

        const next = await findNextAvailability(search, missing.map((room) => room.id), signal);
        if (signal.aborted) return;
        setSoldOutRooms(
          missing.map((room) => {
            const hit = next.get(room.id);
            return {
              ...room,
              soldOut: hit
                ? { status: "found" as const, search: hit.search, totalPrice: hit.totalPrice }
                : { status: "none" as const },
            };
          }),
        );
      } catch (error) {
        if ((error as Error)?.name === "AbortError") return;
        // Sem a lista de quartos o painel segue só com o que tem vaga.
      }
    }

    void loadOffers();
    return () => controller.abort();
  }, [initialSearch, offerSearch, onLowestOfferChange, showSoldOutRooms]);

  // Ordem fixa dos quartos (Térreo, Superior, Chalé, Anexo), com os sem vaga entre os demais.
  const panelRooms = useMemo<PanelRoom[]>(
    () => (offers ? sortRoomsForDisplay<PanelRoom>([...offers.slice(0, 4), ...soldOutRooms]) : []),
    [offers, soldOutRooms],
  );
  // Sem o hóspede ter escolhido, abre o primeiro quarto que tem vaga (não o que está sem vaga).
  const firstAvailableIndex = panelRooms.findIndex((room) => !room.soldOut);
  const openPanelIndex = panelTouched ? activePanel : Math.max(0, firstAvailableIndex);

  const resultUrl = `/reservar?${new URLSearchParams({
    checkIn: offerSearch.checkIn,
    checkOut: offerSearch.checkOut,
    adults: String(offerSearch.adults),
    children: String(offerSearch.children),
    ...(offerSearch.children > 0 ? { childrenAges: offerSearch.childrenAges.slice(0, offerSearch.children).map((age) => String(age)).join(",") } : {}),
  }).toString()}`;
  const dateLabel = `${format(new Date(`${offerSearch.checkIn}T12:00:00`), "dd MMM", { locale: ptBR })} – ${format(new Date(`${offerSearch.checkOut}T12:00:00`), "dd MMM yyyy", { locale: ptBR })}`;
  const isOfferToday = offerSearch.checkIn === format(new Date(), "yyyy-MM-dd");
  const offerRangeLabel = `${isOfferToday ? "hoje, " : ""}${formatShortRange(offerSearch.checkIn, offerSearch.checkOut)}`;
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
        childrenAges: draftSearch.childrenAges
          .slice(0, draftSearch.children)
          .filter((age): age is number => typeof age === "number"),
      });
    }, 400);
    return () => window.clearTimeout(timeoutId);
  }, [canApplyDraft, draftSearch, isSearchModalOpen, offerSearch]);

  const openRoomGallery = (room: HomeOffer) => {
    const photos = getOfferPhotos(room);
    if (photos.length === 0) return;
    setRoomGallery({ roomName: room.name, photos: buildRoomGalleryPhotos(room.name, photos), currentIndex: 0 });
  };

  const moveGalleryPhoto = (step: number) => {
    setRoomGallery((current) => current ? { ...current, currentIndex: (current.currentIndex + step + current.photos.length) % current.photos.length } : current);
  };

  return (
    <section className={`${homeStyles.fit} bg-[color:var(--brand-cream)] py-10 md:pb-8 md:pt-[104px]`} aria-labelledby="home-offers-title">
      <div className="container flex min-h-0 flex-col md:h-full">
        <div className="mb-5 flex shrink-0 flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className={`${homeStyles.eyebrow} text-[color:var(--brand-forest)]`}>
              Disponibilidade real
            </p>
            <h2 id="home-offers-title" className={`${homeStyles.display} ${homeStyles.displayDark} mt-5 text-[clamp(1.9rem,min(4.6vw,7vh),3.8rem)] text-[color:var(--brand-forest)]`}>
              Escolha sua <em>acomodação</em>
            </h2>
            <p className="mt-2 max-w-2xl text-base leading-7 text-[rgba(40,50,35,0.75)]">
              Valores calculados pelo motor para {guestLabel}, de {dateLabel}. Altere as datas para consultar sua estadia.
            </p>
            {notice ? (
              <p role="status" className="mt-3 inline-block max-w-2xl border border-brand-gold/40 bg-brand-gold/15 px-3 py-2 text-sm font-medium text-brand-brown-dark">
                {notice}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col items-start gap-3 md:items-end">
            <button
              type="button"
              onClick={openSearchModal}
              className="inline-flex h-12 items-center justify-center gap-2 border border-primary/15 bg-white px-5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
            >
              Consultar outras datas <ArrowRight className="h-4 w-4" />
            </button>
            <p
              aria-hidden="true"
              className={`hidden text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[color:var(--brand-forest)] transition-opacity duration-500 md:inline-flex md:items-center md:gap-2 ${panelTouched || panelRooms.length < 2 ? "opacity-0" : "opacity-100"}`}
            >
              Passe o mouse pelos quartos
              <span className="inline-block animate-[wing-nudge_1.6s_ease-in-out_infinite]">→</span>
            </p>
          </div>
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
                    childrenAges: next.childrenAges,
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
          <div className="flex min-h-0 flex-col gap-3 md:flex-1 md:flex-row md:gap-2">
            {panelRooms.map((room, roomIndex) => {
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
              const isActive = openPanelIndex === roomIndex;
              const soldOut = room.soldOut;
              const nextUrl = soldOut?.status === "found"
                ? `/reservar?${new URLSearchParams({
                    checkIn: soldOut.search.checkIn,
                    checkOut: soldOut.search.checkOut,
                    adults: String(offerSearch.adults),
                    children: String(offerSearch.children),
                    ...(offerSearch.children > 0 ? { childrenAges: offerSearch.childrenAges.slice(0, offerSearch.children).map((age) => String(age)).join(",") } : {}),
                    roomTypeId: room.id,
                  }).toString()}`
                : null;
              const choosePanel = () => {
                setPanelTouched(true);
                setActivePanel(roomIndex);
              };

              return (
                <article
                  key={room.id}
                  onMouseEnter={choosePanel}
                  onFocus={choosePanel}
                  style={{ "--grow": isActive ? 5 : 1 } as React.CSSProperties}
                  className={`group relative overflow-hidden bg-[color:var(--brand-forest)] text-white transition-[flex] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] md:min-h-0 md:[flex:var(--grow)_1_0%] ${soldOut ? "min-h-[440px]" : "min-h-[360px]"}`}
                >
                  {image ? (
                    <Image
                      src={image}
                      alt=""
                      fill
                      sizes="(max-width: 767px) 100vw, 70vw"
                      quality={82}
                      className={`object-cover transition-transform duration-1000 group-hover:scale-105 ${soldOut ? "saturate-50" : ""}`}
                    />
                  ) : null}
                  <div className={`absolute inset-0 ${soldOut ? "bg-[linear-gradient(180deg,rgba(20,28,18,0.35)_20%,rgba(20,28,18,0.92)_100%)]" : "bg-[linear-gradient(180deg,rgba(20,28,18,0.05)_30%,rgba(20,28,18,0.9)_100%)] max-md:bg-[linear-gradient(180deg,rgba(20,28,18,0.35)_0%,rgba(20,28,18,0.92)_70%)]"}`} />

                  {canOpenGallery ? (
                    <button
                      type="button"
                      aria-label={`Ver fotos (${photos.length}): ${room.name}`}
                      onClick={() => openRoomGallery(room)}
                      className="absolute inset-0 z-0 cursor-zoom-in outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--brand-gold)]"
                    />
                  ) : null}

                  {/* Painel fechado (desktop): número e nome na vertical */}
                  <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute inset-0 hidden flex-col justify-between p-5 transition-opacity duration-500 md:flex ${isActive ? "opacity-0" : "opacity-100"}`}
                  >
                    <span />
                    <span className={`${homeStyles.display} rotate-180 text-xl [writing-mode:vertical-rl]`}>{room.name}</span>
                  </div>

                  <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-col items-start gap-2">
                    {canOpenGallery ? (
                      <span className="inline-flex items-center gap-2 bg-[rgba(40,50,35,0.9)] px-3 py-1.5 text-xs font-semibold">
                        <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                        Ver fotos ({photos.length})
                      </span>
                    ) : null}
                    {soldOut ? (
                      <span className="inline-flex items-center gap-2 bg-white px-3 py-1.5 text-xs font-bold text-[color:var(--brand-forest)]">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                        {isOfferToday ? "Indisponível hoje" : "Indisponível nestas datas"}
                      </span>
                    ) : null}
                  </div>

                  {/* Painel aberto (desktop) / sempre visível (celular) */}
                  <div
                    className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 p-5 transition-all duration-700 md:p-7 ${isActive ? "md:translate-y-0 md:opacity-100" : "md:translate-y-4 md:opacity-0"}`}
                  >
                    <h3 className={`${homeStyles.display} text-[clamp(1.7rem,min(2.8vw,5vh),2.8rem)]`}>{room.name}</h3>
                    {maxGuests > 0 ? (
                      <p className="mt-2 inline-flex items-center gap-2 text-sm text-white/85">
                        <Users className="h-4 w-4" aria-hidden="true" /> Até {maxGuests} hóspedes
                      </p>
                    ) : null}
                    {amenities.length > 0 ? (
                      <ul className="mt-3 flex flex-wrap gap-2 text-xs">
                        {amenities.map((amenity) => (
                          <li key={amenity} className="inline-flex items-center gap-1.5 border border-white/30 px-2.5 py-1">
                            <Check className="h-3 w-3 text-[color:var(--brand-gold)]" aria-hidden="true" /> {amenity}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {soldOut ? (
                      <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-3">
                        <div>
                          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-gold)]">
                            {soldOut.status === "found" ? "Próxima data disponível" : "Sem vaga por enquanto"}
                          </p>
                          {soldOut.status === "found" ? (
                            <>
                              <p className={`${homeStyles.display} mt-1 text-[1.8rem]`}>{formatShortRange(soldOut.search.checkIn, soldOut.search.checkOut)}</p>
                              <p className="mt-1 text-xs text-white/75">
                                Total para {soldOut.search.nights} {soldOut.search.nights === 1 ? "noite" : "noites"}: {formatBrl(soldOut.totalPrice)} · {guestLabel}
                              </p>
                            </>
                          ) : soldOut.status === "searching" ? (
                            <p className="mt-1 text-sm text-white/85">Procurando a próxima data com vaga…</p>
                          ) : (
                            <p className="mt-1 text-sm text-white/85">Sem vaga nos próximos {NEXT_AVAILABLE_WINDOW_DAYS} dias. Consulte outras datas.</p>
                          )}
                        </div>
                        {nextUrl ? (
                          <Link
                            href={nextUrl}
                            className="pointer-events-auto inline-flex h-12 items-center justify-center gap-2 bg-[color:var(--brand-gold)] px-6 text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--brand-forest)] transition-opacity hover:opacity-90"
                          >
                            Ver essa data <ArrowRight className="h-4 w-4" aria-hidden="true" />
                          </Link>
                        ) : soldOut.status === "none" ? (
                          <button
                            type="button"
                            onClick={openSearchModal}
                            className="pointer-events-auto inline-flex h-12 items-center justify-center gap-2 border border-white/60 px-6 text-xs font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-white/10"
                          >
                            Consultar outras datas
                          </button>
                        ) : null}
                      </div>
                    ) : (
                    <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-3">
                        <div>
                          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/80">
                            Total para {offerSearch.nights} {offerSearch.nights === 1 ? "noite" : "noites"} · {offerRangeLabel}
                          </p>
                          <p className={`${homeStyles.display} mt-1 text-[2.1rem]`}>{formatBrl(Number(room.totalPrice))}</p>
                          <p className="mt-1 text-xs text-white/75">{guestLabel} · só para essas datas</p>
                        </div>
                        <Link
                          href={roomUrl}
                          className="pointer-events-auto inline-flex h-12 items-center justify-center gap-2 bg-[color:var(--brand-gold)] px-6 text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--brand-forest)] transition-opacity hover:opacity-90"
                        >
                          Escolher esta acomodação <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {roomGallery ? (
          <PhotoLightbox
            photos={roomGallery.photos}
            index={roomGallery.currentIndex}
            onClose={() => setRoomGallery(null)}
            onMove={moveGalleryPhoto}
            onSelect={(index) => setRoomGallery((current) => current ? { ...current, currentIndex: index } : current)}
          />
        ) : null}
      </div>
    </section>
  );
}
