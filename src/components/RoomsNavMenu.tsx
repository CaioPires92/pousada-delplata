"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { isAnnexWingRoom, isMainWingRoom } from "@/lib/rooms";

type NavRoom = { id: string; name: string };

// Lista de quartos do menu: busca uma única vez, na primeira vez que alguém abre o submenu.
export function useNavRooms() {
  const [rooms, setRooms] = useState<NavRoom[]>([]);
  const started = useRef(false);

  const load = useCallback(() => {
    if (started.current) return;
    started.current = true;
    fetch("/api/rooms")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: unknown) => {
        if (!Array.isArray(data)) return;
        setRooms(
          data
            .filter((room): room is NavRoom => typeof room?.id === "string" && typeof room?.name === "string")
            .map((room) => ({ id: room.id, name: room.name })),
        );
      })
      .catch(() => {
        started.current = false;
      });
  }, []);

  const wings = [
    { label: "Ala principal", rooms: rooms.filter((room) => isMainWingRoom(room.name)) },
    { label: "Chalés e anexos", rooms: rooms.filter((room) => isAnnexWingRoom(room.name)) },
  ].filter((wing) => wing.rooms.length > 0);

  return { wings, load };
}

type DesktopProps = {
  linkClassName: string;
  wings: { label: string; rooms: NavRoom[] }[];
  load: () => void;
};

export function RoomsNavDesktop({ linkClassName, wings, load }: DesktopProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        load();
        setOpen(true);
      }}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => {
        load();
        setOpen(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <Link href="/acomodacoes" aria-haspopup="true" aria-expanded={open} className={`inline-flex items-center gap-1 ${linkClassName}`}>
        Acomodações
        <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </Link>

      {wings.length > 0 ? (
        <div
          className={`absolute left-1/2 top-full z-50 -translate-x-1/2 pt-4 transition-all duration-200 ${open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0"}`}
        >
          <div className="min-w-[260px] border border-[color:var(--line-dark)] bg-[color:var(--brand-cream)] p-6 text-left font-sans shadow-[0_18px_40px_rgba(9,9,9,0.14)]">
            {wings.map((wing, index) => (
              <div key={wing.label} className={index > 0 ? "mt-5 border-t border-[color:var(--line-dark)] pt-5" : ""}>
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--brand-forest)]/55">{wing.label}</p>
                <ul className="mt-3 space-y-1">
                  {wing.rooms.map((room) => (
                    <li key={room.id}>
                      <Link
                        href={`/acomodacoes/${room.id}`}
                        onClick={() => setOpen(false)}
                        className="block py-1 text-[0.95rem] font-normal normal-case tracking-normal text-[color:var(--brand-forest)] [text-shadow:none] transition-colors hover:text-[#7a7720]"
                      >
                        {room.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <Link
              href="/acomodacoes"
              onClick={() => setOpen(false)}
              className="mt-5 block border-t border-[color:var(--line-dark)] pt-4 text-[0.8rem] font-medium normal-case tracking-normal text-[color:var(--brand-forest)]/70 [text-shadow:none] transition-colors hover:text-[color:var(--brand-forest)]"
            >
              Ver todas as acomodações →
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type MobileProps = {
  wings: { label: string; rooms: NavRoom[] }[];
  load: () => void;
  onNavigate: () => void;
};

export function RoomsNavMobile({ wings, load, onNavigate }: MobileProps) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between">
        <Link href="/acomodacoes" className="block font-medium text-primary/90 transition-colors hover:text-secondary" onClick={onNavigate}>
          Acomodações
        </Link>
        <button
          type="button"
          aria-label={open ? "Recolher acomodações" : "Ver cada acomodação"}
          aria-expanded={open}
          className="p-2 text-primary"
          onClick={() => {
            load();
            setOpen(!open);
          }}
        >
          <ChevronDown aria-hidden="true" className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open ? (
        <div className="mt-1 space-y-3 border-l-2 border-[color:var(--brand-gold)] pl-4">
          {wings.map((wing) => (
            <div key={wing.label}>
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-primary/60">{wing.label}</p>
              {wing.rooms.map((room) => (
                <Link key={room.id} href={`/acomodacoes/${room.id}`} onClick={onNavigate} className="block py-1.5 text-sm font-medium text-primary/90">
                  {room.name}
                </Link>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
