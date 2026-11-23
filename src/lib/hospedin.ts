export interface HospedinAvailability {
  date: string;
  rate_price: number;
  availability: number;
}

export interface HospedinSession {
  token: string;
}

export class HospedinApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = 'HospedinApiError';
  }
}

/** Valores da Vercel às vezes chegam com um "\n" literal no fim. */
function readEnv(name: string) {
  return String(process.env[name] || '').replace(/\\n$/, '').trim();
}

function apiRoot() {
  return (readEnv('HOSPEDIN_BASE_URL') || 'https://pms-api.hospedin.com/api/v2').replace(/\/api\/v\d+\/?$/, '');
}

/**
 * API v2 (login com e-mail e senha). Usada só para ler o estoque na sincronização.
 */
class HospedinClient {
  private token: string | null = null;
  private authenticationPromise: Promise<string> | null = null;

  private get baseUrl() {
    return readEnv('HOSPEDIN_BASE_URL') || 'https://pms-api.hospedin.com/api/v2';
  }

  private async authenticate(): Promise<string> {
    if (this.token) return this.token;
    if (this.authenticationPromise) return this.authenticationPromise;

    this.authenticationPromise = (async () => {
      const response = await fetch(`${this.baseUrl}/authentication/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: readEnv('HOSPEDIN_EMAIL'),
          password: readEnv('HOSPEDIN_PASSWORD'),
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        throw new Error(`Hospedin Auth Failed: ${response.statusText}`);
      }

      const data: HospedinSession = await response.json();
      this.token = data.token;
      return this.token;
    })();

    try {
      return await this.authenticationPromise;
    } finally {
      this.authenticationPromise = null;
    }
  }

  async getAvailability(
    placeTypeId: string,
    beginDate: string,
    endDate: string
  ): Promise<HospedinAvailability[]> {
    const token = await this.authenticate();
    const url = `${this.baseUrl}/${readEnv('HOSPEDIN_ACCOUNT_ID')}/place_types/${placeTypeId}/rates_and_availabilities?begin_date=${beginDate}&end_date=${endDate}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`Hospedin API Error: ${response.statusText} for placeType ${placeTypeId}`);
    }

    return await response.json();
  }
}

export const hospedinClient = new HospedinClient();

// ---------------------------------------------------------------------------
// API v3 (Client ID + Client Secret, criados em Minha conta → Integrações).
// Documentação: https://pms.hospedin.com/api-docs/v3/swagger.yaml
// ---------------------------------------------------------------------------

type JsonApiResource<A> = { type: string; id: string; attributes: A };
type JsonApiDocument<A> = { data: JsonApiResource<A>; meta?: unknown };
type JsonApiCollection<A> = { data: Array<JsonApiResource<A>>; links?: { next?: string | null } };

export type HospedinBookingUnitInput = {
  place_id: number;
  status?: 'pre_reservation' | 'reservation' | 'blocked';
  adults?: number;
  children?: number;
  children_ages?: number[];
  exempt?: number;
  daily_cents?: number;
  total_daily_cents?: number;
  has_payment_coming_from_ota?: boolean;
};

export type HospedinBookingInput = {
  check_in: string;
  check_out: string;
  sale_channel_id?: number;
  guest_id?: number;
  note?: string;
  units: HospedinBookingUnitInput[];
};

export type HospedinPaymentInput = {
  payment_method: 'cash' | 'credit_card' | 'debit_card' | 'boleto' | 'deposit' | 'bank_transfer' | 'pix';
  account_transaction_id: number;
  transaction_category_id: number;
  price_cents: number;
  transaction_at: string;
  description?: string;
  note?: string;
  status?: boolean;
};

export type HospedinGuestInput = {
  name: string;
  email?: string;
  note?: string;
  contact_attributes?: { ddi?: string; phone?: string };
};

export type HospedinAccountSettings = {
  pricing_field?: 'daily_cents' | 'total_daily_cents';
  default_account_transaction_id?: number | null;
  default_reservation_transaction_category?: number | null;
};

export function isHospedinV3Configured() {
  return Boolean(readEnv('HOSPEDIN_CLIENT_ID') && readEnv('HOSPEDIN_CLIENT_SECRET'));
}

class HospedinV3Client {
  private token: { value: string; expiresAt: number } | null = null;
  private tokenPromise: Promise<string> | null = null;

  private get baseUrl() {
    return `${apiRoot()}/api/v3`;
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    if (this.tokenPromise) return this.tokenPromise;

    this.tokenPromise = (async () => {
      const response = await fetch(`${this.baseUrl}/authentication/access_tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/vnd.api+json' },
        body: JSON.stringify({ client_id: readEnv('HOSPEDIN_CLIENT_ID'), client_secret: readEnv('HOSPEDIN_CLIENT_SECRET') }),
        signal: AbortSignal.timeout(15_000),
      });
      const text = await response.text();
      if (!response.ok) {
        throw new HospedinApiError(`Hospedin v3 auth: ${response.status}`, response.status, text.slice(0, 500));
      }
      const meta = (JSON.parse(text) as { meta: { access_token: string; expires_in?: number } }).meta;
      this.token = { value: meta.access_token, expiresAt: Date.now() + Number(meta.expires_in || 3600) * 1000 };
      return meta.access_token;
    })();

    try {
      return await this.tokenPromise;
    } finally {
      this.tokenPromise = null;
    }
  }

  /** Chamada autenticada em `/api/v3/{path}`; renova o token uma vez em 401. */
  async request<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
    const send = async () =>
      fetch(`${this.baseUrl}/${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${await this.accessToken()}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.api+json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });

    let response = await send();
    if (response.status === 401) {
      this.token = null;
      response = await send();
    }
    const text = await response.text();
    if (!response.ok) {
      throw new HospedinApiError(`Hospedin v3 ${method} ${path.split('?')[0]}: ${response.status}`, response.status, text.slice(0, 500));
    }
    return (text ? JSON.parse(text) : null) as T;
  }

  async getAccountSettings() {
    return (await this.request<JsonApiDocument<HospedinAccountSettings>>('GET', 'account/settings')).data.attributes;
  }

  /** UHs (quartos) de uma categoria, na ordem da API. */
  async listRoomIds(placeTypeId: number) {
    const ids: number[] = [];
    let path: string | null = 'rooms?page[size]=100';
    while (path) {
      const page: JsonApiCollection<{ place_type_id: number; status: boolean }> = await this.request('GET', path);
      for (const room of page.data) {
        if (room.attributes.place_type_id === placeTypeId && room.attributes.status !== false) ids.push(Number(room.id));
      }
      path = page.links?.next ? page.links.next.replace(/^.*\/api\/v3\//, '') : null;
    }
    return ids;
  }

  /** Todas as UHs (quartos) ativas e a categoria de cada uma. */
  async listRooms() {
    const rooms: Array<{ id: number; placeTypeId: number }> = [];
    let path: string | null = 'rooms?page[size]=100';
    while (path) {
      const page: JsonApiCollection<{ place_type_id: number; status: boolean }> = await this.request('GET', path);
      for (const room of page.data) {
        if (room.attributes.status !== false) rooms.push({ id: Number(room.id), placeTypeId: Number(room.attributes.place_type_id) });
      }
      path = page.links?.next ? page.links.next.replace(/^.*\/api\/v3\//, '') : null;
    }
    return rooms;
  }

  /** Disponibilidade noite a noite de UMA UH em [checkIn, checkOut). */
  async getRoomAvailability(placeId: number, checkIn: string, checkOut: string) {
    const res = await this.request<JsonApiCollection<{ date: string; availability: number }>>(
      'GET',
      `availabilities?check_in=${checkIn}&check_out=${checkOut}&place_id=${placeId}`,
    );
    return res.data.map((night) => ({ date: night.attributes.date, availability: Number(night.attributes.availability) }));
  }

  /** A UH está livre em todas as noites de [checkIn, checkOut)? */
  async isRoomFree(placeId: number, checkIn: string, checkOut: string) {
    const res = await this.request<JsonApiCollection<{ date: string; availability: number }>>(
      'GET',
      `availabilities?check_in=${checkIn}&check_out=${checkOut}&place_id=${placeId}`,
    );
    return res.data.length > 0 && res.data.every((night) => night.attributes.availability >= 1);
  }

  async createGuest(attributes: HospedinGuestInput) {
    const res = await this.request<JsonApiDocument<unknown>>('POST', 'guests', { data: { type: 'guests', attributes } });
    return Number(res.data.id);
  }

  async createBooking(attributes: HospedinBookingInput) {
    const res = await this.request<JsonApiDocument<{ units: Array<{ unit_id: number; place_id: number; place_type_id: number | null }> }>>(
      'POST',
      'bookings',
      { data: { type: 'reservations', attributes } },
    );
    return { id: res.data.id, units: res.data.attributes.units };
  }

  async cancelBooking(bookingId: string) {
    await this.request('POST', `bookings/${encodeURIComponent(bookingId)}/cancel?scope=all`);
  }

  async addPayment(bookingId: string, attributes: HospedinPaymentInput) {
    const res = await this.request<JsonApiDocument<unknown>>('POST', `bookings/${encodeURIComponent(bookingId)}/payments`, {
      data: { type: 'payments', attributes },
    });
    return res.data.id;
  }
}

export const hospedinV3 = new HospedinV3Client();
