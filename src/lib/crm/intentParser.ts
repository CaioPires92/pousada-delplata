import { compareDayKey, isDayKey } from "@/lib/day-key";

export type CrmIntent =
  | "quote"
  | "reservation"
  | "checkin_info"
  | "checkout_info"
  | "amenity"
  | "pet"
  | "parking"
  | "location"
  | "unknown";

export type ParsedCrmIntent = {
  intent: CrmIntent;
  checkin?: string;
  checkout?: string;
  adults?: number;
  children?: number;
  childrenAges?: number[];
  missingFields: Array<"checkin" | "checkout" | "adults">;
  confidence: "low" | "medium" | "high";
};

type DateCandidate = {
  day: number;
  month?: number;
  year?: number;
  index: number;
};

const MONTHS: Record<string, number> = {
  janeiro: 1,
  jan: 1,
  fevereiro: 2,
  fev: 2,
  marco: 3,
  mar: 3,
  abril: 4,
  abr: 4,
  maio: 5,
  mai: 5,
  junho: 6,
  jun: 6,
  julho: 7,
  jul: 7,
  agosto: 8,
  ago: 8,
  setembro: 9,
  set: 9,
  outubro: 10,
  out: 10,
  novembro: 11,
  nov: 11,
  dezembro: 12,
  dez: 12,
};

const INTENT_KEYWORDS: Array<{ intent: CrmIntent; patterns: RegExp[] }> = [
  { intent: "reservation", patterns: [/\b(reserv|fechar|confirmar|pagamento|pagar|pix|cart[aã]o)\b/] },
  { intent: "quote", patterns: [/\b(pre[cç]o|valor|di[aá]ria|or[cç]amento|cot(a|ar)|disponibilidade|tem vaga|quanto fica|quanto sai)\b/] },
  { intent: "checkin_info", patterns: [/\bcheck[\s-]?in\b/, /\bentrada\b/] },
  { intent: "checkout_info", patterns: [/\bcheck[\s-]?out\b/, /\bsa[ií]da\b/] },
  { intent: "pet", patterns: [/\b(pet|cachorro|gato|animal)\b/] },
  { intent: "parking", patterns: [/\b(estacionamento|garagem|vaga)\b/] },
  { intent: "location", patterns: [/\b(localiza[cç][aã]o|endere[cç]o|onde fica|dist[aâ]ncia)\b/] },
  { intent: "amenity", patterns: [/\b(piscina|caf[eé]|wifi|internet|ar condicionado|frigobar)\b/] },
];

function normalizeText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function dateFromReference(referenceDate: Date) {
  return referenceDate.toISOString().slice(0, 10);
}

function isValidDateParts(day: number, month: number, year: number) {
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function toDayKey(candidate: DateCandidate, referenceDate: Date) {
  if (!candidate.month) return null;

  const referenceYear = referenceDate.getUTCFullYear();
  let year = candidate.year ?? referenceYear;

  if (!isValidDateParts(candidate.day, candidate.month, year)) return null;

  let dayKey = `${year}-${pad2(candidate.month)}-${pad2(candidate.day)}`;
  const referenceDayKey = dateFromReference(referenceDate);

  if (!candidate.year && compareDayKey(dayKey, referenceDayKey) < 0) {
    year += 1;
    if (!isValidDateParts(candidate.day, candidate.month, year)) return null;
    dayKey = `${year}-${pad2(candidate.month)}-${pad2(candidate.day)}`;
  }

  return isDayKey(dayKey) ? dayKey : null;
}

function findDateCandidates(text: string): DateCandidate[] {
  const candidates: DateCandidate[] = [];
  const occupied = new Set<number>();
  const numericDateRegex = /\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/g;
  let match: RegExpExecArray | null;

  while ((match = numericDateRegex.exec(text))) {
    const year = match[3] ? normalizeYear(Number.parseInt(match[3], 10)) : undefined;
    candidates.push({
      day: Number.parseInt(match[1], 10),
      month: Number.parseInt(match[2], 10),
      year,
      index: match.index,
    });

    for (let i = match.index; i < match.index + match[0].length; i += 1) {
      occupied.add(i);
    }
  }

  const monthNames = Object.keys(MONTHS).join("|");
  const textualDateRegex = new RegExp(`\\b(\\d{1,2})\\s*(?:de\\s*)?(${monthNames})(?:\\s*(?:de\\s*)?(\\d{2,4}))?\\b`, "g");

  while ((match = textualDateRegex.exec(text))) {
    if (occupied.has(match.index)) continue;

    candidates.push({
      day: Number.parseInt(match[1], 10),
      month: MONTHS[match[2]],
      year: match[3] ? normalizeYear(Number.parseInt(match[3], 10)) : undefined,
      index: match.index,
    });
  }

  const rangeWithSharedMonthRegex = new RegExp(`\\b(\\d{1,2})\\s*(?:a|ate|-)\\s*(\\d{1,2})\\s*(?:de\\s*)?(${monthNames})(?:\\s*(?:de\\s*)?(\\d{2,4}))?\\b`, "g");

  while ((match = rangeWithSharedMonthRegex.exec(text))) {
    const month = MONTHS[match[3]];
    const year = match[4] ? normalizeYear(Number.parseInt(match[4], 10)) : undefined;
    candidates.push({ day: Number.parseInt(match[1], 10), month, year, index: match.index });
    candidates.push({ day: Number.parseInt(match[2], 10), month, year, index: match.index + match[0].lastIndexOf(match[2]) });
  }

  return candidates.sort((a, b) => a.index - b.index);
}

function normalizeYear(year: number) {
  if (year < 100) return 2000 + year;
  return year;
}

function inferMissingMonths(candidates: DateCandidate[]) {
  return candidates.map((candidate, index) => {
    if (candidate.month) return candidate;

    const nextWithMonth = candidates.slice(index + 1).find(item => item.month);
    const previousWithMonth = [...candidates.slice(0, index)].reverse().find(item => item.month);
    return {
      ...candidate,
      month: nextWithMonth?.month ?? previousWithMonth?.month,
      year: candidate.year ?? nextWithMonth?.year ?? previousWithMonth?.year,
    };
  });
}

function extractDates(text: string, referenceDate: Date) {
  const rawCandidates = findDateCandidates(text);
  const dateKeys = inferMissingMonths(rawCandidates)
    .map(candidate => toDayKey(candidate, referenceDate))
    .filter((value): value is string => Boolean(value));
  const uniqueDateKeys = Array.from(new Set(dateKeys));

  if (uniqueDateKeys.length < 2) {
    return { checkin: uniqueDateKeys[0], checkout: undefined };
  }

  const [first, second] = uniqueDateKeys;
  if (compareDayKey(first, second) < 0) {
    return { checkin: first, checkout: second };
  }

  return { checkin: second, checkout: first };
}

function extractAdults(text: string) {
  const casalMatch = /\b(casal|eu e (minha|meu) (esposa|esposo|marido|mulher|namorada|namorado))\b/.exec(text);
  if (casalMatch) return 2;

  const adultMatch = /\b(\d{1,2})\s*(adultos?|pessoas? adultas?|h[oó]spedes? adultos?)\b/.exec(text);
  if (adultMatch) return Number.parseInt(adultMatch[1], 10);

  const peopleMatch = /\b(?:para|somos|em)\s*(\d{1,2})\s*(pessoas?|h[oó]spedes?)\b/.exec(text);
  if (peopleMatch && !/\b(criancas?|filhos?|beb[eê]s?)\b/.test(text)) {
    return Number.parseInt(peopleMatch[1], 10);
  }

  return undefined;
}

function extractChildren(text: string) {
  const explicitMatch = /\b(\d{1,2})\s*(criancas?|filhos?|menores|beb[eê]s?)\b/.exec(text);
  const ages = Array.from(text.matchAll(/\b(?:crianca|filho|filha|menor|idade|idades)?\s*(?:de|com)?\s*(\d{1,2})\s*anos?\b/g))
    .map(match => Number.parseInt(match[1], 10))
    .filter(age => age >= 0 && age <= 17);

  if (explicitMatch) {
    return {
      children: Number.parseInt(explicitMatch[1], 10),
      childrenAges: ages,
    };
  }

  if (ages.length > 0 && /\b(criancas?|filhos?|menores)\b/.test(text)) {
    return {
      children: ages.length,
      childrenAges: ages,
    };
  }

  return {
    children: undefined,
    childrenAges: [] as number[],
  };
}

function detectIntent(text: string, datesFound: boolean): CrmIntent {
  for (const item of INTENT_KEYWORDS) {
    if (item.patterns.some(pattern => pattern.test(text))) return item.intent;
  }

  if (datesFound && /\b(adultos?|criancas?|pessoas?|h[oó]spedes?|casal)\b/.test(text)) {
    return "quote";
  }

  return "unknown";
}

function confidenceFor(parsed: Omit<ParsedCrmIntent, "confidence">): ParsedCrmIntent["confidence"] {
  if (parsed.intent === "unknown") return "low";
  if (parsed.intent === "quote" && parsed.checkin && parsed.checkout && parsed.adults) return "high";
  return "medium";
}

export function parseCrmIntent(message: string, referenceDate = new Date()): ParsedCrmIntent {
  const text = normalizeText(message);
  const { checkin, checkout } = extractDates(text, referenceDate);
  const adults = extractAdults(text);
  const { children, childrenAges } = extractChildren(text);
  const intent = detectIntent(text, Boolean(checkin || checkout));
  const missingFields: ParsedCrmIntent["missingFields"] = [];

  if (intent === "quote") {
    if (!checkin) missingFields.push("checkin");
    if (!checkout) missingFields.push("checkout");
    if (!adults) missingFields.push("adults");
  }

  const parsed = {
    intent,
    checkin,
    checkout,
    adults,
    children,
    childrenAges,
    missingFields,
  };

  return {
    ...parsed,
    confidence: confidenceFor(parsed),
  };
}
