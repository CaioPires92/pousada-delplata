import { hospedinV3, isHospedinV3Configured } from '@/lib/hospedin';
import { normalizeGuestPhone } from '@/lib/checkin-whatsapp';

/**
 * Lê no Hospedin (API v3, somente leitura) as reservas com check-in próximo e o link do check-in online
 * de cada UH, para a equipe mandar por WhatsApp. Não grava nada no Hospedin nem no banco do site.
 *
 * O `check_in_online_url` é credencial (quem tem o link edita os dados de check-in): nunca vai para log.
 */

type Page<T> = { data: Array<{ id: string; attributes: T }>; links?: { next?: string | null } };

type UnitAttributes = {
  unit_id: number;
  place_id: number;
  status: string;
  check_in: string;
  check_out: string;
  adults?: number;
  children?: number;
  guest_id?: number | null;
  check_in_online_url?: string | null;
  guests?: Array<{ guest_id: number; name?: string | null; role?: string }>;
};

type ReservationAttributes = {
  kind: 'single' | 'group';
  guest_id?: number | null;
  units: UnitAttributes[];
};

type GuestAttributes = {
  name: string;
  contact?: { ddi?: string | null; phone?: string | null; extra_ddi?: string | null; extra_phone?: string | null } | null;
};

export type CheckinRow = {
  /** Estável por UH: usado pelo navegador para lembrar quem já recebeu. */
  key: string;
  bookingId: string;
  unitId: number;
  guestName: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  status: string;
  phone: string | null;
  phoneIssue: string | null;
  checkinUrl: string | null;
};

export type CheckinListing = {
  from: string;
  to: string;
  rows: CheckinRow[];
  diagnostics: { units: number; withLink: number; withPhone: number };
};

const ACTIVE_STATUSES = 'pre_reservation,reservation';
const MAX_PAGES = 10;
const GUEST_CONCURRENCY = 5;

function nextPath(page: Page<unknown>) {
  const next = page.links?.next;
  return next ? next.replace(/^.*\/api\/v3\//, '') : null;
}

async function mapWithLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export function isValidIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** Reservas ativas (pré-reserva e reservada) com check-in entre `from` e `to`, ambos inclusos (YYYY-MM-DD). */
export async function listCheckinRows(from: string, to: string): Promise<CheckinListing> {
  if (!isHospedinV3Configured()) {
    throw new Error('hospedin_v3_not_configured');
  }

  const units: Array<{ bookingId: string; unit: UnitAttributes; fallbackGuestId: number | null }> = [];
  let path: string | null =
    `bookings?page[size]=100&filter[status]=${ACTIVE_STATUSES}` +
    `&filter[check_in][gte]=${from}&filter[check_in][lte]=${to}`;

  for (let pageIndex = 0; path && pageIndex < MAX_PAGES; pageIndex += 1) {
    const page: Page<ReservationAttributes> = await hospedinV3.request('GET', path);
    for (const reservation of page.data) {
      for (const unit of reservation.attributes.units || []) {
        if (!ACTIVE_STATUSES.split(',').includes(unit.status)) continue;
        const day = String(unit.check_in).slice(0, 10);
        if (day < from || day > to) continue;
        units.push({
          bookingId: reservation.id,
          unit,
          fallbackGuestId: reservation.attributes.guest_id ?? null,
        });
      }
    }
    path = nextPath(page);
  }

  const guestIds = [
    ...new Set(
      units
        .map(({ unit, fallbackGuestId }) => unit.guest_id ?? fallbackGuestId)
        .filter((id): id is number => typeof id === 'number'),
    ),
  ];

  const guests = new Map<number, GuestAttributes | null>();
  await mapWithLimit(guestIds, GUEST_CONCURRENCY, async (id) => {
    try {
      const res = await hospedinV3.request<{ data: { attributes: GuestAttributes } }>('GET', `guests/${id}`);
      guests.set(id, res.data.attributes);
    } catch {
      guests.set(id, null);
    }
  });

  const rows: CheckinRow[] = units.map(({ bookingId, unit, fallbackGuestId }) => {
    const guestId = unit.guest_id ?? fallbackGuestId;
    const guest = guestId != null ? guests.get(guestId) ?? null : null;
    const contact = guest?.contact ?? null;

    const mainPhone = normalizeGuestPhone(contact?.phone, contact?.ddi);
    const extraPhone = mainPhone ? null : normalizeGuestPhone(contact?.extra_phone, contact?.extra_ddi);
    const phone = mainPhone ?? extraPhone;

    let phoneIssue: string | null = null;
    if (!phone) {
      phoneIssue = contact?.phone || contact?.extra_phone ? 'Telefone inválido ou de outro país' : 'Sem telefone no Hospedin';
    }

    return {
      key: `${bookingId}:${unit.unit_id}`,
      bookingId,
      unitId: unit.unit_id,
      guestName: guest?.name || unit.guests?.find((g) => g.role === 'responsible')?.name || 'Hóspede',
      checkIn: unit.check_in,
      checkOut: unit.check_out,
      adults: unit.adults ?? 0,
      children: unit.children ?? 0,
      status: unit.status,
      phone,
      phoneIssue,
      checkinUrl: unit.check_in_online_url || null,
    };
  });

  rows.sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.guestName.localeCompare(b.guestName, 'pt-BR'));

  return {
    from,
    to,
    rows,
    diagnostics: {
      units: rows.length,
      withLink: rows.filter((r) => r.checkinUrl).length,
      withPhone: rows.filter((r) => r.phone).length,
    },
  };
}
