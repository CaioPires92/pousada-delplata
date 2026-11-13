export interface HospedinAvailability {
  date: string;
  rate_price: number;
  availability: number;
}

export interface HospedinSession {
  token: string;
}

class HospedinClient {
  private baseUrl: string;
  private email: string;
  private pass: string;
  private accountId: string;
  private token: string | null = null;
  private authenticationPromise: Promise<string> | null = null;

  constructor() {
    this.baseUrl = process.env.HOSPEDIN_BASE_URL || 'https://pms-api.hospedin.com/api/v2';
    this.email = process.env.HOSPEDIN_EMAIL || '';
    this.pass = process.env.HOSPEDIN_PASSWORD || '';
    this.accountId = process.env.HOSPEDIN_ACCOUNT_ID || '';
  }

  private async authenticate(): Promise<string> {
    if (this.token) return this.token;
    if (this.authenticationPromise) return this.authenticationPromise;

    this.authenticationPromise = (async () => {
      const response = await fetch(`${this.baseUrl}/authentication/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: this.email,
          password: this.pass,
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
    const url = `${this.baseUrl}/${this.accountId}/place_types/${placeTypeId}/rates_and_availabilities?begin_date=${beginDate}&end_date=${endDate}`;

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
