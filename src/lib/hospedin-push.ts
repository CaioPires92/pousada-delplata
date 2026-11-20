import { after } from 'next/server';

import { getEffectiveGuestCounts, requiresFourGuestInventory } from '@/lib/guest-capacity';
import {
  HospedinApiError,
  type HospedinAccountSettings,
  type HospedinBookingInput,
  type HospedinPaymentInput,
  hospedinV3,
  isHospedinV3Configured,
} from '@/lib/hospedin';
import { syncHospedinAvailability } from '@/lib/hospedin-sync';
import { opsLog } from '@/lib/ops-log';
import prisma from '@/lib/prisma';

/**
 * Envia as reservas confirmadas do site para o Hospedin (API v3), que repassa o estoque ao Booking/Expedia.
 *
 * Marcadores no Booking (colunas que já existem no banco):
 * - `hospedinReservationId` = id da reserva no Hospedin (`r_123`). Durante o envio fica `pending:<data>`,
 *   para webhook e cron ao mesmo tempo não criarem duas reservas.
 * - `hospedinRegisteredAt` preenchido = a reserva está ativa no Hospedin. A partir daí o estoque do site
 *   deixa de contá-la (o Hospedin já desconta), exceto no estoque de 4 hóspedes, que só o site tem.
 *   Ao cancelar lá, volta para null e o id fica guardado.
 *
 * Desligado por padrão. Liga com HOSPEDIN_PUSH_ENABLED=true + HOSPEDIN_PUSH_SINCE (só reservas criadas a
 * partir dessa data, para não duplicar as que a equipe já lançou à mão) + HOSPEDIN_SITE_SALE_CHANNEL_ID +
 * HOSPEDIN_CLIENT_ID/HOSPEDIN_CLIENT_SECRET. Opcional: HOSPEDIN_FOUR_GUEST_PLACE_IDS (quartos que cabem 4,
 * preferidos para reservas de 4 hóspedes).
 */

const ACTIVE_STATUSES = ['CONFIRMED', 'PAID'];
const CANCELLED_STATUSES = ['CANCELLED', 'EXPIRED', 'REFUNDED'];
const PENDING_PREFIX = 'pending:';

type PushConfig = { since: Date; saleChannelId: number; fourGuestPlaceIds: number[] };

export function getHospedinPushConfig(): PushConfig | null {
  if (process.env.HOSPEDIN_PUSH_ENABLED !== 'true') return null;
  const since = new Date(String(process.env.HOSPEDIN_PUSH_SINCE || '').trim());
  const saleChannelId = Number.parseInt(String(process.env.HOSPEDIN_SITE_SALE_CHANNEL_ID || ''), 10);
  const valid = !Number.isNaN(since.getTime()) && Number.isFinite(saleChannelId) && saleChannelId > 0 && isHospedinV3Configured();
  if (!valid) {
    opsLog('error', 'HOSPEDIN_PUSH_MISCONFIGURED', {
      hasSince: !Number.isNaN(since.getTime()),
      hasSaleChannel: Number.isFinite(saleChannelId) && saleChannelId > 0,
      hasV3Credentials: isHospedinV3Configured(),
    });
    return null;
  }
  const fourGuestPlaceIds = String(process.env.HOSPEDIN_FOUR_GUEST_PLACE_IDS || '')
    .split(',')
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isFinite(value) && value > 0);
  return { since, saleChannelId, fourGuestPlaceIds };
}

export type PushResult =
  | { status: 'pushed'; hospedinReservationId: string }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; error: string };

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toCents(value: unknown) {
  return Math.round(Number(value || 0) * 100);
}

function formatBRL(value: unknown) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function errorMessage(error: unknown) {
  if (error instanceof HospedinApiError) return `${error.message} ${error.body}`.trim();
  return error instanceof Error ? error.message : String(error);
}

const bookingSelect = {
  id: true,
  status: true,
  createdAt: true,
  checkIn: true,
  checkOut: true,
  adults: true,
  childrenAges: true,
  pets: true,
  totalPrice: true,
  subtotalPrice: true,
  discountAmount: true,
  appliedCouponCode: true,
  promotionName: true,
  promotionDiscount: true,
  hospedinReservationId: true,
  hospedinRegisteredAt: true,
  guest: { select: { name: true, email: true, phone: true } },
  roomType: { select: { id: true, name: true, externalId: true } },
  payment: {
    select: {
      amount: true,
      totalAmount: true,
      remainingAmount: true,
      balanceDueDate: true,
      method: true,
      cardBrand: true,
      installments: true,
      provider: true,
      providerId: true,
      status: true,
    },
  },
} as const;

type PushBooking = NonNullable<Awaited<ReturnType<typeof loadBooking>>>;

function loadBooking(bookingId: string) {
  return prisma.booking.findUnique({ where: { id: bookingId }, select: bookingSelect });
}

/** Prefixo no nome do hóspede: a equipe bate o olho no mapa e sabe que a reserva veio do site. */
export const SITE_GUEST_PREFIX = 'SITE - ';

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10).split('-').reverse().join('/');
}

/** Observação com todos os detalhes que o site tem da reserva. */
export function buildHospedinReservationNote(booking: PushBooking) {
  const nights = Math.max(1, Math.round((booking.checkOut.getTime() - booking.checkIn.getTime()) / 86_400_000));
  const counts = getEffectiveGuestCounts({ adults: booking.adults, childrenAges: booking.childrenAges });
  const lines = [
    `RESERVA FEITA PELO SITE (enviada automaticamente)`,
    `Código no site: ${booking.id.slice(0, 8).toUpperCase()} (${booking.id})`,
    `Feita em: ${formatDate(booking.createdAt)}`,
    `Quarto reservado: ${booking.roomType.name}`,
    `Estadia: ${formatDate(booking.checkIn)} a ${formatDate(booking.checkOut)} (${nights} ${nights === 1 ? 'noite' : 'noites'})`,
    `Hóspede: ${booking.guest.name}`,
    `E-mail: ${booking.guest.email}`,
    `Telefone: ${booking.guest.phone || 'não informado'}`,
    `Adultos: ${counts.effectiveAdults}`,
  ];
  if (counts.childrenAges.length > 0) {
    lines.push(`Crianças: ${counts.childrenAges.length} (idades: ${counts.childrenAges.join(', ')}; de 6 a 11 pagam, até 5 cortesia)`);
  }
  lines.push(`Pets: ${booking.pets > 0 ? booking.pets : 'nenhum'}`);

  if (booking.subtotalPrice !== null && Number(booking.subtotalPrice) !== Number(booking.totalPrice)) {
    lines.push(`Subtotal: ${formatBRL(booking.subtotalPrice)}`);
  }
  if (booking.promotionName) {
    lines.push(`Promoção: ${booking.promotionName}${Number(booking.promotionDiscount || 0) > 0 ? ` (-${formatBRL(booking.promotionDiscount)})` : ''}`);
  }
  if (booking.appliedCouponCode) {
    lines.push(`Cupom: ${booking.appliedCouponCode}${Number(booking.discountAmount || 0) > 0 ? ` (-${formatBRL(booking.discountAmount)})` : ''}`);
  }
  lines.push(`Total da reserva: ${formatBRL(booking.totalPrice)}`);

  const payment = booking.payment;
  if (payment) {
    const how = [payment.method, payment.cardBrand].filter(Boolean).join(' ');
    const installments = Number(payment.installments || 0) > 1 ? ` em ${payment.installments}x` : '';
    lines.push(`Pago no site: ${formatBRL(payment.amount)}${how ? ` (${how}${installments})` : ''}${payment.provider ? ` via ${payment.provider}` : ''}`);
    if (payment.providerId) lines.push(`ID do pagamento: ${payment.providerId}`);
    if (Number(payment.remainingAmount || 0) > 0) {
      const due = payment.balanceDueDate ? ` até ${formatDate(payment.balanceDueDate)}` : '';
      lines.push(`SALDO A RECEBER: ${formatBRL(payment.remainingAmount)}${due}`);
    }
  } else {
    lines.push('Pagamento: sem registro de pagamento no site');
  }
  return lines.join('\n');
}

export function buildHospedinBookingInput(
  booking: PushBooking,
  options: { saleChannelId: number; guestId: number; placeId: number; pricingField?: HospedinAccountSettings['pricing_field'] },
): HospedinBookingInput {
  const nights = Math.max(1, Math.round((booking.checkOut.getTime() - booking.checkIn.getTime()) / 86_400_000));
  const totalCents = toCents(booking.totalPrice);
  const counts = getEffectiveGuestCounts({ adults: booking.adults, childrenAges: booking.childrenAges });
  const payingChildrenAges = counts.childrenAges.filter((age) => age >= 6 && age <= 11);
  // A conta só lê o campo do seu modo de preço (`pricing_field`); o outro é ignorado ou recalculado.
  const price = options.pricingField === 'daily_cents'
    ? { daily_cents: Math.round(totalCents / nights) }
    : { total_daily_cents: totalCents };
  return {
    check_in: dayKey(booking.checkIn),
    check_out: dayKey(booking.checkOut),
    sale_channel_id: options.saleChannelId,
    guest_id: options.guestId,
    note: buildHospedinReservationNote(booking),
    units: [{
      place_id: options.placeId,
      status: 'reservation',
      adults: counts.effectiveAdults,
      children: payingChildrenAges.length,
      ...(payingChildrenAges.length > 0 ? { children_ages: payingChildrenAges } : {}),
      exempt: counts.freeChildren,
      has_payment_coming_from_ota: false,
      ...price,
    }],
  };
}

export function mapPaymentMethod(method: string | null | undefined): HospedinPaymentInput['payment_method'] {
  const value = String(method || '').toLowerCase();
  if (value.includes('pix')) return 'pix';
  if (value.includes('debit')) return 'debit_card';
  if (value.includes('bol') || value.includes('ticket')) return 'boleto';
  return 'credit_card';
}

let settingsCache: { value: HospedinAccountSettings; expiresAt: number } | null = null;
async function getAccountSettings() {
  if (settingsCache && settingsCache.expiresAt > Date.now()) return settingsCache.value;
  const value = await hospedinV3.getAccountSettings();
  settingsCache = { value, expiresAt: Date.now() + 60 * 60_000 };
  return value;
}

/**
 * Primeiro quarto livre em todas as noites, SEMPRE do tipo que o hóspede reservou (nunca troca Térreo por
 * Superior etc.). Reserva de 4 tenta antes, dentro desse tipo, os quartos que recebem 4.
 */
async function pickFreeRoom(booking: PushBooking, config: PushConfig) {
  const placeTypeId = Number(booking.roomType.externalId);
  const roomIds = await hospedinV3.listRoomIds(placeTypeId);
  const counts = getEffectiveGuestCounts({ adults: booking.adults, childrenAges: booking.childrenAges });
  const preferred = requiresFourGuestInventory(counts.effectiveGuests)
    ? roomIds.filter((id) => config.fourGuestPlaceIds.includes(id))
    : [];
  const ordered = [...preferred, ...roomIds.filter((id) => !preferred.includes(id))];
  for (const placeId of ordered) {
    if (await hospedinV3.isRoomFree(placeId, dayKey(booking.checkIn), dayKey(booking.checkOut))) return placeId;
  }
  return null;
}

/**
 * Sempre cria o hóspede com "SITE - " no nome (o nome é o que aparece no mapa). Não reaproveita um
 * cadastro existente pelo e-mail, porque aí o nome não teria a marca do site.
 */
async function createSiteGuest(booking: PushBooking) {
  const email = booking.guest.email.trim().toLowerCase();
  return hospedinV3.createGuest({
    name: `${SITE_GUEST_PREFIX}${booking.guest.name.trim()}`,
    ...(email ? { email } : {}),
    ...(booking.guest.phone ? { contact_attributes: { ddi: 'BR', phone: booking.guest.phone } } : {}),
  });
}

/** Lança no Hospedin o valor já pago no site. Falha aqui não desfaz a reserva: o valor também está na observação. */
async function postPayment(booking: PushBooking, hospedinReservationId: string, settings: HospedinAccountSettings) {
  const payment = booking.payment;
  if (!payment || String(payment.status).toUpperCase() !== 'APPROVED' || Number(payment.amount || 0) <= 0) return;
  const accountId = Number(settings.default_account_transaction_id);
  const categoryId = Number(settings.default_reservation_transaction_category);
  if (!accountId || !categoryId) {
    opsLog('warn', 'HOSPEDIN_PAYMENT_SKIPPED', { bookingId: booking.id, reason: 'no_default_account_or_category' });
    return;
  }
  try {
    await hospedinV3.addPayment(hospedinReservationId, {
      payment_method: mapPaymentMethod(payment.method),
      account_transaction_id: accountId,
      transaction_category_id: categoryId,
      price_cents: toCents(payment.amount),
      transaction_at: new Date().toISOString(),
      description: `Pagamento no site (${payment.provider || 'online'})`,
      status: true,
    });
  } catch (error) {
    opsLog('error', 'HOSPEDIN_PAYMENT_FAILED', { bookingId: booking.id, hospedinReservationId, error: errorMessage(error) });
  }
}

/** Atualiza o estoque do quarto logo após a mudança; sem isso o site ficaria até 30 min desatualizado. */
async function resyncRoom(booking: PushBooking) {
  if (process.env.HOSPEDIN_SYNC_ENABLED !== 'true') return;
  try {
    await syncHospedinAvailability({
      roomTypeId: booking.roomType.id,
      beginDate: dayKey(booking.checkIn),
      endDate: dayKey(booking.checkOut),
    });
  } catch (error) {
    opsLog('warn', 'HOSPEDIN_PUSH_RESYNC_FAILED', { bookingId: booking.id, error: errorMessage(error) });
  }
}

type PushOptions = { resync?: boolean };

export async function pushBookingToHospedin(
  bookingId: string,
  config = getHospedinPushConfig(),
  options: PushOptions = {},
): Promise<PushResult> {
  if (!config) return { status: 'skipped', reason: 'disabled' };

  const booking = await loadBooking(bookingId);
  if (!booking) return { status: 'skipped', reason: 'not_found' };
  if (!ACTIVE_STATUSES.includes(String(booking.status).toUpperCase())) return { status: 'skipped', reason: 'not_confirmed' };
  // Id real com hospedinRegisteredAt vazio = foi cancelada lá e confirmada de novo aqui: cria outra reserva.
  if (booking.hospedinRegisteredAt || booking.hospedinReservationId?.startsWith(PENDING_PREFIX)) {
    return { status: 'skipped', reason: 'already_sent' };
  }
  if (booking.createdAt < config.since) return { status: 'skipped', reason: 'before_cutoff' };
  if (booking.checkOut.getTime() <= Date.now()) return { status: 'skipped', reason: 'past_stay' };
  if (!booking.roomType.externalId || !Number.isFinite(Number(booking.roomType.externalId))) {
    return { status: 'failed', error: 'room_without_hospedin_id' };
  }

  // Trava: só quem conseguir trocar o valor lido → pending segue adiante.
  const claim = await prisma.booking.updateMany({
    where: { id: booking.id, hospedinReservationId: booking.hospedinReservationId, hospedinRegisteredAt: null },
    data: { hospedinReservationId: `${PENDING_PREFIX}${new Date().toISOString()}` },
  });
  if (claim.count !== 1) return { status: 'skipped', reason: 'already_sent' };

  let hospedinReservationId: string;
  let settings: HospedinAccountSettings;
  try {
    settings = await getAccountSettings();
    const placeId = await pickFreeRoom(booking, config);
    if (!placeId) throw new Error('no_free_room_in_hospedin');
    const guestId = await createSiteGuest(booking);
    const created = await hospedinV3.createBooking(
      buildHospedinBookingInput(booking, {
        saleChannelId: config.saleChannelId,
        guestId,
        placeId,
        pricingField: settings.pricing_field,
      }),
    );
    hospedinReservationId = created.id;
    // Trava: a reserva tem de ficar no tipo reservado. Se o Hospedin devolver outro tipo, desfaz na hora.
    const wrongType = created.units.some((unit) => unit.place_type_id !== null && Number(unit.place_type_id) !== Number(booking.roomType.externalId));
    if (wrongType) {
      await hospedinV3.cancelBooking(created.id).catch(() => undefined);
      throw new Error(`hospedin_room_type_mismatch:${created.id}`);
    }
  } catch (error) {
    // Nada foi criado (no máximo o hóspede): devolve o valor anterior para o próximo cron tentar de novo.
    await prisma.booking.updateMany({
      where: { id: booking.id, hospedinReservationId: { startsWith: PENDING_PREFIX } },
      data: { hospedinReservationId: booking.hospedinReservationId },
    });
    const message = errorMessage(error);
    opsLog('error', 'HOSPEDIN_PUSH_FAILED', { bookingId: booking.id, error: message });
    return { status: 'failed', error: message };
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: { hospedinReservationId, hospedinRegisteredAt: new Date() },
  });
  opsLog('info', 'HOSPEDIN_PUSH_DONE', { bookingId: booking.id, hospedinReservationId });
  await postPayment(booking, hospedinReservationId, settings);
  if (options.resync !== false) await resyncRoom(booking);
  return { status: 'pushed', hospedinReservationId };
}

/** Cancela no Hospedin a reserva que foi cancelada/expirada/estornada no site. */
export async function cancelBookingInHospedin(
  bookingId: string,
  config = getHospedinPushConfig(),
  options: PushOptions = {},
): Promise<PushResult> {
  if (!config) return { status: 'skipped', reason: 'disabled' };
  const booking = await loadBooking(bookingId);
  if (!booking) return { status: 'skipped', reason: 'not_found' };
  if (!CANCELLED_STATUSES.includes(String(booking.status).toUpperCase())) return { status: 'skipped', reason: 'not_cancelled' };
  const id = booking.hospedinReservationId;
  if (!booking.hospedinRegisteredAt || !id || id.startsWith(PENDING_PREFIX)) return { status: 'skipped', reason: 'not_in_hospedin' };

  try {
    await hospedinV3.cancelBooking(id);
  } catch (error) {
    const message = errorMessage(error);
    opsLog('error', 'HOSPEDIN_CANCEL_FAILED', { bookingId: booking.id, hospedinReservationId: id, error: message });
    return { status: 'failed', error: message };
  }
  await prisma.booking.update({ where: { id: booking.id }, data: { hospedinRegisteredAt: null } });
  opsLog('info', 'HOSPEDIN_CANCEL_DONE', { bookingId: booking.id, hospedinReservationId: id });
  if (options.resync !== false) await resyncRoom(booking);
  return { status: 'pushed', hospedinReservationId: id };
}

/**
 * Rodada do cron: envia o que ficou para trás e cancela o que foi cancelado no site.
 * Travas `pending:` que sobraram (o processo caiu no meio) NÃO são reenviadas, porque a reserva
 * pode ter sido criada lá; aparecem em `stuck` para alguém conferir no Hospedin.
 */
// Poucas por rodada: escolher o quarto faz várias chamadas e o cron tem 60 s.
export async function reconcileBookingsWithHospedin(limit = 5) {
  const config = getHospedinPushConfig();
  if (!config) return { enabled: false as const };

  const now = new Date();
  const [toPush, toCancel, stuck] = await Promise.all([
    prisma.booking.findMany({
      where: {
        status: { in: ACTIVE_STATUSES },
        hospedinRegisteredAt: null,
        // null = nunca enviada; id real = cancelada lá e confirmada de novo aqui.
        OR: [
          { hospedinReservationId: null },
          { hospedinReservationId: { not: { startsWith: PENDING_PREFIX } } },
        ],
        createdAt: { gte: config.since },
        checkOut: { gt: now },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: limit,
    }),
    prisma.booking.findMany({
      where: {
        status: { in: CANCELLED_STATUSES },
        hospedinRegisteredAt: { not: null },
        hospedinReservationId: { not: null },
      },
      select: { id: true },
      take: limit,
    }),
    prisma.booking.findMany({
      where: {
        hospedinReservationId: { startsWith: PENDING_PREFIX },
        updatedAt: { lt: new Date(now.getTime() - 10 * 60_000) },
      },
      select: { id: true },
    }),
  ]);

  const pushed: Array<{ bookingId: string } & PushResult> = [];
  for (const { id } of toPush) pushed.push({ bookingId: id, ...(await pushBookingToHospedin(id, config, { resync: false })) });
  const cancelled: Array<{ bookingId: string } & PushResult> = [];
  for (const { id } of toCancel) cancelled.push({ bookingId: id, ...(await cancelBookingInHospedin(id, config, { resync: false })) });

  if (stuck.length > 0) opsLog('error', 'HOSPEDIN_PUSH_STUCK', { bookingIds: stuck.map((b) => b.id) });
  return { enabled: true as const, pushed, cancelled, stuck: stuck.map((b) => b.id) };
}

/** Envio logo após a confirmação, sem atrasar a resposta. Se falhar, o cron de 30 min tenta de novo. */
export function queueHospedinPush(bookingId: string) {
  if (process.env.HOSPEDIN_PUSH_ENABLED !== 'true') return;
  const run = () =>
    pushBookingToHospedin(bookingId).catch((error) => {
      opsLog('error', 'HOSPEDIN_PUSH_FAILED', { bookingId, error: errorMessage(error) });
    });
  try {
    after(run);
  } catch {
    // Fora de uma requisição (scripts/testes): o cron cuida.
  }
}
