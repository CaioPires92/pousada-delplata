'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Edit3, Percent, Plus, Power, Trash2, X } from 'lucide-react';
import { daysBetween, defaultBadgeLabel, todayDayKey, type PromotionType } from '@/lib/promotions/engine';
import { countDaysInRanges, normalizeRanges, type DayRange } from '@/lib/promotions/day-ranges';
import PromotionCalendar from './PromotionCalendar';

type Promotion = {
    id: string;
    name: string;
    badgeLabel: string | null;
    type: PromotionType;
    active: boolean;
    discountPercent: number | string;
    maxDiscountAmount: number | string | null;
    minDaysBeforeCheckIn: number | null;
    maxDaysBeforeCheckIn: number | null;
    stayStart: string | null;
    stayEnd: string | null;
    /** JSON [{from,to}] com as datas em que a promoção não vale */
    excludedStayDates?: string | null;
    /** JSON [0..6] (0 = domingo) com os dias da semana em que vale; vazio = todos */
    daysOfWeek?: string | null;
    bookableFrom: string | null;
    bookableUntil: string | null;
    minNights: number | null;
    allowedRoomTypeIds: string | null;
    stackWithCoupons: boolean;
    allowedCouponIds: string | null;
    stackWithPromotions: boolean;
    allowedPromotionIds: string | null;
    exclusive: boolean;
    audience?: string | null;
    showBadge?: boolean | null;
};

type DateRange = DayRange;
type Room = { id: string; name: string };
type CouponOption = { id: string; name: string; code?: string | null; active: boolean };

type FormState = {
    name: string;
    badgeLabel: string;
    active: boolean;
    discountPercent: string;
    maxDiscountAmount: string;
    minDaysBeforeCheckIn: string;
    maxDaysBeforeCheckIn: string;
    stayStart: string;
    stayEnd: string;
    /** Datas em que a promoção NÃO vale (ex.: tirar só o dia 25 de novembro) */
    excludedStayRanges: DateRange[];
    /** Dias da semana em que vale (0 = domingo … 6 = sábado); os 7 marcados = todos os dias */
    daysOfWeek: number[];
    bookableFrom: string;
    bookableUntil: string;
    minNights: string;
    allowedRoomTypeIds: string[];
    exclusive: boolean;
    /** 'all' = todos; 'mobile' = só quem reserva pelo celular */
    audience: 'all' | 'mobile';
    /** Mostrar a etiqueta/nome da promoção ao hóspede */
    showBadge: boolean;
    /** "Acumular com todos os cupons" */
    allCoupons: boolean;
    couponIds: string[];
    /** "Acumular com qualquer outra promoção" */
    allPromotions: boolean;
    promotionIds: string[];
};

/** Ordem de exibição (segunda a domingo) com o número do dia (0 = domingo). */
const WEEKDAY_OPTIONS = [
    { n: 1, label: 'Seg' }, { n: 2, label: 'Ter' }, { n: 3, label: 'Qua' }, { n: 4, label: 'Qui' },
    { n: 5, label: 'Sex' }, { n: 6, label: 'Sáb' }, { n: 0, label: 'Dom' },
];
const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

const emptyForm = (): FormState => ({
    name: '',
    badgeLabel: '',
    active: true,
    discountPercent: '10',
    maxDiscountAmount: '',
    minDaysBeforeCheckIn: '',
    maxDaysBeforeCheckIn: '',
    stayStart: '',
    stayEnd: '',
    excludedStayRanges: [],
    daysOfWeek: [...ALL_WEEKDAYS],
    bookableFrom: '',
    bookableUntil: '',
    minNights: '',
    allowedRoomTypeIds: [],
    exclusive: false,
    audience: 'all',
    showBadge: true,
    allCoupons: false,
    couponIds: [],
    allPromotions: false,
    promotionIds: [],
});

const day = (value: string | null) => (value ? value.slice(0, 10) : '');
const dayBR = (value: string | null) => (value ? day(value).split('-').reverse().join('/') : '');

function parseIds(value: string | null): string[] | null {
    if (!value) return null;
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(String) : null;
    } catch {
        return null;
    }
}

function parseRanges(value: string | null | undefined): DateRange[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) return [];
        return normalizeRanges(parsed.flatMap((item) => {
            const from = day(item?.from ?? null);
            const to = day(item?.to ?? item?.from ?? null);
            return from && to && from <= to ? [{ from, to }] : [];
        }));
    } catch {
        return [];
    }
}

const rangeLabel = (r: DateRange) => (r.from === r.to ? dayBR(r.from) : `${dayBR(r.from)} a ${dayBR(r.to)}`);

function parseWeekdays(value: string | null | undefined): number[] {
    if (!value) return [...ALL_WEEKDAYS];
    try {
        const parsed = JSON.parse(value);
        const days = Array.isArray(parsed) ? parsed.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6) : [];
        return days.length > 0 ? Array.from(new Set(days)).sort((a, b) => a - b) : [...ALL_WEEKDAYS];
    } catch {
        return [...ALL_WEEKDAYS];
    }
}

/** Texto ao vivo com o que a promoção vai fazer (como o resumo "aplicado entre ..." do Booking). */
function describeApplication(form: FormState) {
    const window =
        form.stayStart && form.stayEnd ? `nas noites de ${dayBR(form.stayStart)} a ${dayBR(form.stayEnd)}`
            : form.stayStart ? `nas noites a partir de ${dayBR(form.stayStart)}`
                : form.stayEnd ? `nas noites até ${dayBR(form.stayEnd)}`
                    : 'em qualquer noite futura';
    const parts = [`O desconto será aplicado ${window}`];
    if (form.daysOfWeek.length > 0 && form.daysOfWeek.length < 7) {
        const ordered = WEEKDAY_OPTIONS.filter((w) => form.daysOfWeek.includes(w.n)).map((w) => w.label);
        parts.push(`somente em: ${ordered.join(', ')}`);
    }
    if (form.excludedStayRanges.length > 0) {
        const shown = form.excludedStayRanges.slice(0, 6).map(rangeLabel);
        const extra = form.excludedStayRanges.length - shown.length;
        parts.push(`exceto: ${shown.join(', ')}${extra > 0 ? ` e mais ${extra}` : ''}`);
    }
    return parts.join(' · ');
}

function toForm(p: Promotion): FormState {
    const couponIds = parseIds(p.allowedCouponIds);
    const promotionIds = parseIds(p.allowedPromotionIds);
    return {
        name: p.name,
        badgeLabel: p.badgeLabel ?? '',
        active: p.active,
        discountPercent: String(p.discountPercent),
        maxDiscountAmount: p.maxDiscountAmount === null ? '' : String(p.maxDiscountAmount),
        minDaysBeforeCheckIn: p.minDaysBeforeCheckIn === null ? '' : String(p.minDaysBeforeCheckIn),
        maxDaysBeforeCheckIn: p.maxDaysBeforeCheckIn === null ? '' : String(p.maxDaysBeforeCheckIn),
        stayStart: day(p.stayStart),
        stayEnd: day(p.stayEnd),
        excludedStayRanges: parseRanges(p.excludedStayDates),
        daysOfWeek: parseWeekdays(p.daysOfWeek),
        bookableFrom: day(p.bookableFrom),
        bookableUntil: day(p.bookableUntil),
        minNights: p.minNights === null ? '' : String(p.minNights),
        allowedRoomTypeIds: parseIds(p.allowedRoomTypeIds) ?? [],
        exclusive: p.exclusive,
        audience: p.audience === 'mobile' ? 'mobile' : 'all',
        showBadge: p.showBadge !== false,
        allCoupons: !p.exclusive && p.stackWithCoupons && couponIds === null,
        couponIds: couponIds ?? [],
        allPromotions: !p.exclusive && p.stackWithPromotions && promotionIds === null,
        promotionIds: promotionIds ?? [],
    };
}

/** Converte o formulário no contrato da API: acumula quando "todos" está marcado ou há itens selecionados. */
function toPayload(form: FormState) {
    const stackWithCoupons = !form.exclusive && (form.allCoupons || form.couponIds.length > 0);
    const stackWithPromotions = !form.exclusive && (form.allPromotions || form.promotionIds.length > 0);
    return {
        name: form.name,
        badgeLabel: form.badgeLabel,
        active: form.active,
        discountPercent: form.discountPercent,
        maxDiscountAmount: form.maxDiscountAmount,
        minDaysBeforeCheckIn: form.minDaysBeforeCheckIn,
        maxDaysBeforeCheckIn: form.maxDaysBeforeCheckIn,
        stayStart: form.stayStart,
        stayEnd: form.stayEnd,
        excludedStayDates: form.excludedStayRanges,
        daysOfWeek: form.daysOfWeek,
        bookableFrom: form.bookableFrom,
        bookableUntil: form.bookableUntil,
        minNights: form.minNights,
        allowedRoomTypeIds: form.allowedRoomTypeIds,
        exclusive: form.exclusive,
        audience: form.audience,
        showBadge: form.showBadge,
        stackWithCoupons,
        allowedCouponIds: stackWithCoupons && !form.allCoupons ? form.couponIds : null,
        stackWithPromotions,
        allowedPromotionIds: stackWithPromotions && !form.allPromotions ? form.promotionIds : null,
    };
}

function hasAnyCondition(form: FormState) {
    return Boolean(
        form.minDaysBeforeCheckIn || form.maxDaysBeforeCheckIn || form.stayStart || form.stayEnd ||
        form.bookableFrom || form.bookableUntil || form.minNights || form.allowedRoomTypeIds.length > 0 ||
        form.excludedStayRanges.length > 0 || form.daysOfWeek.length < 7
    );
}

/**
 * Avisa quando as condições se contradizem e a promoção nunca poderia valer
 * (ex.: exigir 30 dias de antecedência para uma estadia que termina em poucos dias).
 */
function findConflict(form: FormState): string | null {
    const today = todayDayKey();
    const minDays = form.minDaysBeforeCheckIn === '' ? null : Number(form.minDaysBeforeCheckIn);
    const maxDays = form.maxDaysBeforeCheckIn === '' ? null : Number(form.maxDaysBeforeCheckIn);
    const firstSaleDay = form.bookableFrom && form.bookableFrom > today ? form.bookableFrom : today;
    const lastSaleDay = [form.bookableUntil, form.stayEnd].filter(Boolean).sort()[0] || '';

    if (form.stayEnd && form.stayEnd < today) return 'O fim da estadia já passou: esta promoção nunca vai valer.';
    if (form.bookableUntil && form.bookableUntil < today) return 'A janela de vendas já terminou: esta promoção nunca vai valer.';
    if (minDays !== null && Number.isFinite(minDays) && form.stayEnd) {
        const bestLead = daysBetween(firstSaleDay, form.stayEnd);
        if (bestLead < minDays) {
            return `Conflito: a estadia termina em ${dayBR(form.stayEnd)}, no máximo ${Math.max(0, bestLead)} dia(s) após ${dayBR(firstSaleDay)}, mas a regra exige ${minDays}+ dias de antecedência. Nenhuma reserva vai receber este desconto.`;
        }
    }
    if (maxDays !== null && Number.isFinite(maxDays) && form.stayStart && lastSaleDay) {
        const bestLead = daysBetween(lastSaleDay, form.stayStart);
        if (bestLead > maxDays) {
            return `Conflito: a venda termina em ${dayBR(lastSaleDay)} e a estadia começa em ${dayBR(form.stayStart)}, mais de ${maxDays} dia(s) depois. Nenhuma reserva vai receber este desconto.`;
        }
    }
    return null;
}

function ruleSummary(p: Promotion) {
    const parts: string[] = [];
    const min = p.minDaysBeforeCheckIn;
    const max = p.maxDaysBeforeCheckIn;
    if (min !== null && max !== null) parts.push(`Reserva feita de ${min} a ${max} dia(s) antes do check-in`);
    else if (min !== null) parts.push(`Reserva com ${min}+ dias de antecedência`);
    else if (max !== null) parts.push(max === 0 ? 'Reserva para o próprio dia' : `Reserva até ${max} dia(s) antes do check-in`);
    if (p.stayStart && p.stayEnd) parts.push(`Estadia de ${dayBR(p.stayStart)} a ${dayBR(p.stayEnd)}`);
    else if (p.stayStart) parts.push(`Estadia a partir de ${dayBR(p.stayStart)}`);
    else if (p.stayEnd) parts.push(`Estadia até ${dayBR(p.stayEnd)}`);
    const weekdays = parseWeekdays(p.daysOfWeek);
    if (weekdays.length < 7) parts.push(`Só em: ${WEEKDAY_OPTIONS.filter((w) => weekdays.includes(w.n)).map((w) => w.label).join(', ')}`);
    const excluded = parseRanges(p.excludedStayDates);
    if (excluded.length > 0) parts.push(`Não vale em: ${excluded.map(rangeLabel).join(', ')}`);
    if (p.bookableFrom || p.bookableUntil) {
        parts.push(`Vendável ${p.bookableFrom ? `de ${dayBR(p.bookableFrom)} ` : ''}${p.bookableUntil ? `até ${dayBR(p.bookableUntil)}` : ''}`.trim());
    }
    if (p.minNights) parts.push(`Mín. ${p.minNights} noites`);
    if (p.audience === 'mobile') parts.push('Só no celular');
    return parts.length > 0 ? parts.join(' · ') : 'Sem restrições: vale para todas as reservas';
}

function stackSummary(p: Promotion) {
    if (p.exclusive) return null;
    const parts: string[] = [];
    if (p.stackWithCoupons) {
        const ids = parseIds(p.allowedCouponIds);
        parts.push(ids === null ? 'todos os cupons' : `${ids.length} cupom(ns)`);
    }
    if (p.stackWithPromotions) {
        const ids = parseIds(p.allowedPromotionIds);
        parts.push(ids === null ? 'qualquer outra promoção' : `${ids.length} promoção(ões)`);
    }
    return parts.length > 0 ? `Acumula com: ${parts.join(' e ')}*` : null;
}

const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600';
const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1';
const sectionCls = 'rounded-lg border border-slate-200 p-3 sm:col-span-2';

function toggleId(list: string[], id: string, checked: boolean) {
    return checked ? [...list, id] : list.filter((x) => x !== id);
}

export default function PromocoesPage() {
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [coupons, setCoupons] = useState<CouponOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FormState | null>(null);
    const [saving, setSaving] = useState(false);
    const [excludeFrom, setExcludeFrom] = useState('');
    const [excludeTo, setExcludeTo] = useState('');

    const load = useCallback(async () => {
        try {
            const [pRes, rRes, cRes] = await Promise.all([
                fetch('/api/admin/promotions'),
                fetch('/api/admin/rooms'),
                fetch('/api/admin/coupons'),
            ]);
            if (!pRes.ok) throw new Error('Falha ao carregar promoções');
            const pData = await pRes.json();
            const rData = rRes.ok ? await rRes.json() : [];
            const cData = cRes.ok ? await cRes.json() : [];
            setPromotions(Array.isArray(pData) ? pData : []);
            setRooms(Array.isArray(rData) ? rData : []);
            setCoupons(Array.isArray(cData) ? cData : []);
            setError('');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erro ao carregar');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void load();
        }, 0);
        return () => window.clearTimeout(timeoutId);
    }, [load]);

    const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
        setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

    const openCreate = () => {
        setEditingId(null);
        setForm(emptyForm());
        setExcludeFrom('');
        setExcludeTo('');
        setError('');
    };

    const openEdit = (p: Promotion) => {
        setEditingId(p.id);
        setForm(toForm(p));
        setExcludeFrom('');
        setExcludeTo('');
        setError('');
    };

    /** Soma a exceção digitada (data inicial + final opcional) à lista; devolve a lista nova ou null se inválida. */
    const withDraftException = (current: FormState): FormState | null => {
        if (!excludeFrom) return current;
        const to = excludeTo || excludeFrom;
        if (to < excludeFrom) return null;
        if (current.excludedStayRanges.some((r) => r.from === excludeFrom && r.to === to)) return current;
        return { ...current, excludedStayRanges: normalizeRanges([...current.excludedStayRanges, { from: excludeFrom, to }]) };
    };

    const addExcluded = () => {
        if (!form || !excludeFrom) return;
        const next = withDraftException(form);
        if (!next) {
            setError('A data final da exceção não pode ser antes da inicial.');
            return;
        }
        setForm(next);
        setExcludeFrom('');
        setExcludeTo('');
        setError('');
    };

    const removeExcluded = (range: DateRange) =>
        setForm((prev) => (prev ? { ...prev, excludedStayRanges: prev.excludedStayRanges.filter((r) => r !== range) } : prev));

    const save = async () => {
        if (!form) return;
        if (form.daysOfWeek.length === 0) {
            setError('Marque ao menos um dia da semana.');
            return;
        }
        // Se digitou uma exceção e esqueceu de clicar em "Adicionar", ela entra assim mesmo.
        const toSave = withDraftException(form);
        if (!toSave) {
            setError('A data final da exceção não pode ser antes da inicial.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const res = await fetch(editingId ? `/api/admin/promotions/${editingId}` : '/api/admin/promotions', {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(toPayload(toSave)),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || 'Erro ao salvar');
            setForm(null);
            setEditingId(null);
            setNotice('Promoção salva.');
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erro ao salvar');
        } finally {
            setSaving(false);
        }
    };

    const toggle = async (p: Promotion) => {
        const res = await fetch(`/api/admin/promotions/${p.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: !p.active }),
        });
        if (!res.ok) setError('Não foi possível alterar o status.');
        await load();
    };

    const remove = async (p: Promotion) => {
        if (!window.confirm(`Excluir a promoção "${p.name}"? Reservas já feitas mantêm o desconto registrado.`)) return;
        const res = await fetch(`/api/admin/promotions/${p.id}`, { method: 'DELETE' });
        if (!res.ok) setError('Não foi possível excluir.');
        await load();
    };

    if (loading) return <div className="flex min-h-[300px] items-center justify-center text-slate-500">Carregando promoções...</div>;

    const conflict = form ? findConflict(form) : null;
    const activeCoupons = coupons.filter((c) => c.active);
    const otherActivePromotions = promotions.filter((p) => p.active && p.id !== editingId);

    return (
        <div className="pb-10">
            <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                        <Percent size={24} /> Promoções e Tarifas Especiais
                    </h1>
                    <p className="text-sm text-slate-600">
                        Aplicadas automaticamente na reserva: o hóspede recebe a melhor oferta elegível. Promoções só se somam quando todas permitem o acúmulo entre si.
                        O desconto incide sobre a hospedagem (diárias + extras).
                    </p>
                </div>
                <button onClick={openCreate} className="flex shrink-0 items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
                    <Plus size={16} /> Nova promoção
                </button>
            </div>

            {notice ? (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                    <Check size={16} /> {notice}
                    <button className="ml-auto" onClick={() => setNotice('')} aria-label="Fechar aviso"><X size={16} /></button>
                </div>
            ) : null}
            {error && !form ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}

            {promotions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
                    Nenhuma promoção cadastrada. Crie a primeira em &ldquo;Nova promoção&rdquo;.
                </div>
            ) : (
                <div className="grid gap-3">
                    {promotions.map((p) => {
                        const stack = stackSummary(p);
                        return (
                            <div key={p.id} className={`rounded-xl border bg-white p-4 ${p.active ? 'border-slate-200' : 'border-slate-200 opacity-60'}`}>
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <strong className="text-slate-900">{p.name}</strong>
                                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">{Number(p.discountPercent)}% OFF</span>
                                            {p.showBadge === false ? (
                                                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">🏡 Reserva direta</span>
                                            ) : null}
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {p.active ? 'Ativa' : 'Inativa'}
                                            </span>
                                            {p.exclusive ? (
                                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Não acumula com nada</span>
                                            ) : stack ? (
                                                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">{stack}</span>
                                            ) : (
                                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Vale a melhor (sem acumular)</span>
                                            )}
                                        </div>
                                        <p className="mt-1 text-sm text-slate-600">{ruleSummary(p)}</p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            {p.showBadge === false
                                                ? 'Categoria Reserva direta: somada com as outras da categoria; o hóspede vê só "Desconto reserva direta"'
                                                : `Etiqueta: ${p.badgeLabel || defaultBadgeLabel(p.type, Number(p.discountPercent))}`}
                                            {p.maxDiscountAmount ? ` · Teto R$ ${Number(p.maxDiscountAmount).toFixed(2)}` : ''}
                                            {(parseIds(p.allowedRoomTypeIds) ?? []).length ? ` · ${(parseIds(p.allowedRoomTypeIds) ?? []).length} quarto(s)` : ' · Todos os quartos'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => toggle(p)} title={p.active ? 'Desativar' : 'Ativar'} aria-label={p.active ? 'Desativar' : 'Ativar'} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><Power size={18} /></button>
                                        <button onClick={() => openEdit(p)} title="Editar" aria-label="Editar" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><Edit3 size={18} /></button>
                                        <button onClick={() => remove(p)} title="Excluir" aria-label="Excluir" className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 size={18} /></button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            <p className="mt-4 text-xs text-slate-500">
                * O acúmulo só vale quando os dois lados permitem (promoção e cupom, ou promoção e promoção). Com cupom, ele incide sobre o valor já com a promoção.
                Com promoções acumuladas, cada percentual incide sobre o saldo já descontado (10% + 10% = 19%).
                Sem acúmulo, o hóspede paga o menor preço entre as opções. Em empate de desconto, vale a promoção mais recente.
            </p>

            {form ? (
                <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Formulário de promoção">
                    <div className="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-slate-900">{editingId ? 'Editar promoção' : 'Nova promoção'}</h2>
                            <button onClick={() => setForm(null)} aria-label="Fechar"><X size={20} /></button>
                        </div>

                        {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <label className={labelCls} htmlFor="promo-name">Nome da promoção (uso interno)</label>
                                <input id="promo-name" className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex.: Última Hora 10%, Antecipada 30 dias, Férias de Julho, Semana Santa" />
                            </div>
                            <div className="sm:col-span-2">
                                <fieldset>
                                    <legend className={labelCls}>Como esta promoção aparece para o hóspede</legend>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm text-slate-800 ${form.showBadge ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200'}`}>
                                            <input type="radio" name="promo-appearance" className="mt-1" checked={form.showBadge} onChange={() => set('showBadge', true)} />
                                            <span>
                                                <strong>Campanha com etiqueta própria</strong>
                                                <span className="block text-xs text-slate-500">O hóspede vê o nome desta promoção no selo (ex.: Última hora, Reserva antecipada, Mobile).</span>
                                            </span>
                                        </label>
                                        <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm text-slate-800 ${!form.showBadge ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200'}`}>
                                            <input type="radio" name="promo-appearance" className="mt-1" checked={!form.showBadge} onChange={() => set('showBadge', false)} />
                                            <span>
                                                <strong>Categoria Reserva direta</strong>
                                                <span className="block text-xs text-slate-500">
                                                    Desconto permanente de quem reserva direto (ex.: Genius, Não reembolsável). Todas as promoções desta categoria são <strong>somadas numa linha só</strong>:
                                                    o hóspede vê &quot;🏡 Reserva direta&quot; no selo e &quot;Desconto reserva direta&quot; no resumo. O nome desta promoção não aparece.
                                                </span>
                                            </span>
                                        </label>
                                    </div>
                                </fieldset>
                                {form.showBadge ? (
                                    <div className="mt-3">
                                        <label className={labelCls} htmlFor="promo-badge">Etiqueta exibida ao hóspede (opcional)</label>
                                        <input id="promo-badge" className={inputCls} value={form.badgeLabel} onChange={(e) => set('badgeLabel', e.target.value)} placeholder="Ex.: 🔥 Oferta Especial: 10% OFF  ou  🐦 Reserva Antecipada: 15% OFF" />
                                        <p className="mt-1 text-xs text-slate-500">Em branco, usa: {defaultBadgeLabel('CUSTOM', Number(form.discountPercent) || 0)}. O percentual do selo é recalculado sozinho com o desconto real da reserva.</p>
                                    </div>
                                ) : null}
                            </div>
                            <div>
                                <label className={labelCls} htmlFor="promo-pct">Desconto (%)</label>
                                <input id="promo-pct" type="number" min="0.01" max="100" step="0.01" className={inputCls} value={form.discountPercent} onChange={(e) => set('discountPercent', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelCls} htmlFor="promo-max">Teto do desconto em R$ (opcional)</label>
                                <input id="promo-max" type="number" min="0" step="0.01" className={inputCls} value={form.maxDiscountAmount} onChange={(e) => set('maxDiscountAmount', e.target.value)} />
                            </div>

                            <fieldset className={sectionCls}>
                                <legend className={`${labelCls} px-1`}>Condições (preencha só as que quiser aplicar)</legend>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div>
                                        <label className={labelCls} htmlFor="promo-stay-start">Estadia a partir de</label>
                                        <input id="promo-stay-start" type="date" className={inputCls} value={form.stayStart} onChange={(e) => set('stayStart', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className={labelCls} htmlFor="promo-stay-end">Estadia até (última noite)</label>
                                        <input id="promo-stay-end" type="date" className={inputCls} value={form.stayEnd} onChange={(e) => set('stayEnd', e.target.value)} />
                                    </div>
                                    <p className="text-xs text-slate-500 sm:col-span-2">Só as noites dentro do período recebem o desconto (cada noite é avaliada separadamente). Em branco, vale para qualquer data futura.</p>

                                    <div className="sm:col-span-2">
                                        <p className={labelCls}>Dias da semana em que vale</p>
                                        <div className="flex flex-wrap gap-3">
                                            {WEEKDAY_OPTIONS.map((w) => (
                                                <label key={w.n} className="flex items-center gap-1.5 text-sm text-slate-800">
                                                    <input
                                                        type="checkbox"
                                                        checked={form.daysOfWeek.includes(w.n)}
                                                        onChange={(e) => set('daysOfWeek', e.target.checked ? [...form.daysOfWeek, w.n].sort((a, b) => a - b) : form.daysOfWeek.filter((x) => x !== w.n))}
                                                    />
                                                    {w.label}
                                                </label>
                                            ))}
                                        </div>
                                        <p className="mt-1 text-xs text-slate-500">Desmarque um dia da semana para tirá-lo de todo o calendário desta promoção (ex.: todas as segundas).</p>
                                    </div>

                                    <div className="sm:col-span-2" data-testid="promo-excluded-dates">
                                        <p className={labelCls}>Datas em que NÃO vale (clique no calendário)</p>
                                        <PromotionCalendar
                                            key={`${form.stayStart}|${editingId ?? 'new'}`}
                                            stayStart={form.stayStart}
                                            stayEnd={form.stayEnd}
                                            daysOfWeek={form.daysOfWeek}
                                            excluded={form.excludedStayRanges}
                                            today={todayDayKey()}
                                            onChange={(ranges) => set('excludedStayRanges', ranges)}
                                        />
                                        {form.excludedStayRanges.length > 0 ? (
                                            <div className="mt-2">
                                                <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                                                    <span data-testid="promo-excluded-count">{countDaysInRanges(form.excludedStayRanges)} dia(s) removido(s)</span>
                                                    <button type="button" className="font-semibold text-emerald-700 hover:underline" onClick={() => set('excludedStayRanges', [])}>Remover tudo</button>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {form.excludedStayRanges.map((r) => (
                                                        <span key={`${r.from}|${r.to}`} className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                                                            {rangeLabel(r)}
                                                            <button type="button" onClick={() => removeExcluded(r)} aria-label={`Remover exceção ${rangeLabel(r)}`}><X size={12} /></button>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}
                                        <div className="mt-3 flex flex-wrap items-end gap-2">
                                            <div>
                                                <label className="block text-xs text-slate-600" htmlFor="promo-excl-from">De</label>
                                                <input id="promo-excl-from" type="date" className={inputCls} value={excludeFrom} onChange={(e) => setExcludeFrom(e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-slate-600" htmlFor="promo-excl-to">Até (opcional)</label>
                                                <input id="promo-excl-to" type="date" className={inputCls} value={excludeTo} onChange={(e) => setExcludeTo(e.target.value)} />
                                            </div>
                                            <button type="button" onClick={addExcluded} disabled={!excludeFrom} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                                                Adicionar exceção
                                            </button>
                                        </div>
                                        <p className="mt-1 text-xs text-slate-500">
                                            Também dá para digitar um intervalo. Cada noite é avaliada separadamente: uma reserva que passa por um dia removido recebe o desconto <strong>só nas outras noites</strong>.
                                        </p>
                                    </div>

                                    <p className="rounded-md border border-sky-200 bg-sky-50 p-2 text-xs text-sky-900 sm:col-span-2" data-testid="promo-summary">
                                        {describeApplication(form)}
                                    </p>

                                    <div>
                                        <label className={labelCls} htmlFor="promo-mindays">Reservas com no mínimo [ X ] dias de antecedência</label>
                                        <input id="promo-mindays" type="number" min="0" className={inputCls} value={form.minDaysBeforeCheckIn} onChange={(e) => set('minDaysBeforeCheckIn', e.target.value)} placeholder="Ex.: 30 (reserva antecipada)" />
                                    </div>
                                    <div>
                                        <label className={labelCls} htmlFor="promo-maxdays">Reservas com até [ X ] dias antes do check-in</label>
                                        <input id="promo-maxdays" type="number" min="0" className={inputCls} value={form.maxDaysBeforeCheckIn} onChange={(e) => set('maxDaysBeforeCheckIn', e.target.value)} placeholder="Ex.: 3 (última hora); 0 = no próprio dia" />
                                    </div>
                                    <p className="text-xs text-slate-500 sm:col-span-2">Dias de calendário no fuso de São Paulo.</p>

                                    <div>
                                        <label className={labelCls} htmlFor="promo-from">Vendável a partir de</label>
                                        <input id="promo-from" type="date" className={inputCls} value={form.bookableFrom} onChange={(e) => set('bookableFrom', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className={labelCls} htmlFor="promo-until">Vendável até</label>
                                        <input id="promo-until" type="date" className={inputCls} value={form.bookableUntil} onChange={(e) => set('bookableUntil', e.target.value)} />
                                    </div>
                                    <p className="text-xs text-slate-500 sm:col-span-2">Período do calendário em que o hóspede pode comprar com este desconto.</p>

                                    <div>
                                        <label className={labelCls} htmlFor="promo-nights">Mínimo de noites</label>
                                        <input id="promo-nights" type="number" min="1" className={inputCls} value={form.minNights} onChange={(e) => set('minNights', e.target.value)} placeholder="Ex.: 2" />
                                    </div>
                                </div>

                                {rooms.length > 0 ? (
                                    <div className="mt-3">
                                        <p className={labelCls}>Quartos participantes (nenhum marcado = todos)</p>
                                        <div className="flex flex-wrap gap-3">
                                            {rooms.map((r) => (
                                                <label key={r.id} className="flex items-center gap-2 text-sm text-slate-800">
                                                    <input
                                                        type="checkbox"
                                                        checked={form.allowedRoomTypeIds.includes(r.id)}
                                                        onChange={(e) => set('allowedRoomTypeIds', toggleId(form.allowedRoomTypeIds, r.id, e.target.checked))}
                                                    />
                                                    {r.name}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}

                                {conflict ? (
                                    <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">{conflict}</p>
                                ) : null}
                                {!hasAnyCondition(form) ? (
                                    <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                                        Sem nenhuma condição, esta promoção vale para todas as reservas, em todas as datas e quartos.
                                    </p>
                                ) : null}
                            </fieldset>

                            <fieldset className={sectionCls}>
                                <legend className={`${labelCls} px-1`}>Público</legend>
                                <label htmlFor="promo-audience" className="block text-sm text-slate-800">
                                    Quem recebe esta promoção
                                    <select id="promo-audience" className={inputCls} value={form.audience} onChange={(e) => set('audience', e.target.value as 'all' | 'mobile')}>
                                        <option value="all">Todos os visitantes</option>
                                        <option value="mobile">Só quem reserva pelo celular (Mobile rate)</option>
                                    </select>
                                </label>
                            </fieldset>

                            <fieldset className={sectionCls}>
                                <legend className={`${labelCls} px-1`}>Compatibilidade / acúmulo</legend>
                                <label className="flex items-start gap-2 text-sm text-slate-800">
                                    <input type="checkbox" className="mt-1" checked={form.exclusive} onChange={(e) => set('exclusive', e.target.checked)} />
                                    <span><strong>Não acumular com nada</strong> (ex.: Black Friday / queima de estoque) — nenhum cupom nem outra promoção acumula.</span>
                                </label>

                                {!form.exclusive ? (
                                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <p className={labelCls}>Cupons ativos que acumulam</p>
                                            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-800">
                                                <input type="checkbox" checked={form.allCoupons} onChange={(e) => set('allCoupons', e.target.checked)} />
                                                Acumular com todos os cupons
                                            </label>
                                            {!form.allCoupons ? (
                                                activeCoupons.length > 0 ? (
                                                    <div className="max-h-40 space-y-1 overflow-y-auto">
                                                        {activeCoupons.map((c) => (
                                                            <label key={c.id} className="flex items-center gap-2 text-sm text-slate-800">
                                                                <input type="checkbox" checked={form.couponIds.includes(c.id)} onChange={(e) => set('couponIds', toggleId(form.couponIds, c.id, e.target.checked))} />
                                                                {c.name}{c.code ? ` (${c.code})` : ''}
                                                            </label>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-slate-500">Nenhum cupom ativo cadastrado.</p>
                                                )
                                            ) : null}
                                        </div>
                                        <div>
                                            <p className={labelCls}>Outras promoções ativas que acumulam</p>
                                            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-800">
                                                <input type="checkbox" checked={form.allPromotions} onChange={(e) => set('allPromotions', e.target.checked)} />
                                                Acumular com qualquer outra promoção
                                            </label>
                                            {!form.allPromotions ? (
                                                otherActivePromotions.length > 0 ? (
                                                    <div className="max-h-40 space-y-1 overflow-y-auto">
                                                        {otherActivePromotions.map((o) => (
                                                            <label key={o.id} className="flex items-center gap-2 text-sm text-slate-800">
                                                                <input type="checkbox" checked={form.promotionIds.includes(o.id)} onChange={(e) => set('promotionIds', toggleId(form.promotionIds, o.id, e.target.checked))} />
                                                                {o.name}
                                                            </label>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-slate-500">Nenhuma outra promoção ativa.</p>
                                                )
                                            ) : null}
                                        </div>
                                        <p className="text-xs text-slate-500 sm:col-span-2">
                                            O acúmulo só acontece se o outro lado também permitir (o cupom precisa aceitar acúmulo; a outra promoção precisa aceitar esta).
                                            Sem nenhuma marcação, o hóspede paga o menor preço entre as opções.
                                        </p>
                                    </div>
                                ) : null}
                            </fieldset>

                            <label className="flex items-center gap-2 text-sm text-slate-800 sm:col-span-2">
                                <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} /> Promoção ativa
                            </label>
                        </div>

                        <div className="mt-6 flex justify-end gap-2">
                            <button onClick={() => setForm(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
                            <button onClick={save} disabled={saving} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">
                                {saving ? 'Salvando...' : 'Salvar'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
