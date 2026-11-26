'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Loader2, MessageCircle, RefreshCw, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    DEFAULT_CHECKIN_MESSAGE,
    buildCheckinWhatsAppUrl,
    fillCheckinMessage,
    formatCheckinDate,
} from '@/lib/checkin-whatsapp';
import type { CheckinListing, CheckinRow } from '@/lib/hospedin-checkin';

const SENT_KEY = 'checkin-online:sent';
const MESSAGE_KEY = 'checkin-online:message';

function isoToday() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

function isoPlusDays(iso: string, days: number) {
    const date = new Date(`${iso}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

function readStorage<T>(key: string, fallback: T): T {
    try {
        const raw = window.localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
}

function writeStorage(key: string, value: unknown) {
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Sem armazenamento (janela privada): a página continua funcionando, só não lembra.
    }
}

function errorText(code: string | undefined) {
    if (code === 'hospedin_v3_not_configured') return 'As credenciais do Hospedin (v3) não estão configuradas neste ambiente.';
    if (code === 'period_too_long') return 'Escolha um período de até 31 dias.';
    if (code === 'invalid_period') return 'Período inválido.';
    return 'Não foi possível ler as reservas do Hospedin agora. Tente de novo em instantes.';
}

export default function CheckinOnlinePage() {
    const [from, setFrom] = useState(isoToday);
    const [to, setTo] = useState(() => isoPlusDays(isoToday(), 7));
    const [listing, setListing] = useState<CheckinListing | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState<Record<string, string>>({});
    const [message, setMessage] = useState(DEFAULT_CHECKIN_MESSAGE);
    const [hideSent, setHideSent] = useState(true);

    useEffect(() => {
        // Lê o que este navegador lembra (enviados e texto da mensagem); só existe no cliente.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSent(readStorage<Record<string, string>>(SENT_KEY, {}));
        setMessage(readStorage<string>(MESSAGE_KEY, DEFAULT_CHECKIN_MESSAGE));
    }, []);

    const load = useCallback(async () => {
        try {
            const response = await fetch(`/api/admin/checkin-online?from=${from}&to=${to}`, { cache: 'no-store' });
            const body = await response.json().catch(() => ({}));
            setError(null);
            if (!response.ok) {
                setListing(null);
                setError(errorText(body?.error));
                return;
            }
            setListing(body as CheckinListing);
        } catch {
            setListing(null);
            setError(errorText(undefined));
        } finally {
            setLoading(false);
        }
    }, [from, to]);

    const refresh = () => {
        setLoading(true);
        void load();
    };

    useEffect(() => {
        // Carrega uma vez ao abrir; depois, só no botão Atualizar (que liga o "carregando" antes).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const markSent = (key: string) => {
        setSent((current) => {
            const next = { ...current, [key]: new Date().toISOString() };
            writeStorage(SENT_KEY, next);
            return next;
        });
    };

    const unmarkSent = (key: string) => {
        setSent((current) => {
            const next = { ...current };
            delete next[key];
            writeStorage(SENT_KEY, next);
            return next;
        });
    };

    const updateMessage = (value: string) => {
        setMessage(value);
        writeStorage(MESSAGE_KEY, value);
    };

    const rows = useMemo(() => listing?.rows ?? [], [listing]);
    const visibleRows = useMemo(() => (hideSent ? rows.filter((row) => !sent[row.key]) : rows), [rows, sent, hideSent]);
    const pendingCount = rows.filter((row) => !sent[row.key]).length;

    const whatsappUrl = (row: CheckinRow) => {
        if (!row.phone || !row.checkinUrl) return null;
        const text = fillCheckinMessage(message, { nome: row.guestName, checkin: row.checkIn, link: row.checkinUrl });
        return buildCheckinWhatsAppUrl(row.phone, text);
    };

    const diagnostics = listing?.diagnostics;

    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-slate-900">Check-in online por WhatsApp</h1>
                <p className="mt-1 text-sm text-slate-600">
                    Reservas do Hospedin com check-in no período. Toque em &ldquo;Enviar&rdquo;: o WhatsApp abre com a
                    mensagem e o link do check-in online prontos, e você só confirma o envio.
                </p>
            </div>

            <Card className="space-y-4 p-4">
                <div className="flex flex-wrap items-end gap-3">
                    <label className="text-sm text-slate-700">
                        De
                        <input
                            type="date"
                            value={from}
                            onChange={(event) => setFrom(event.target.value)}
                            className="mt-1 block rounded-md border border-slate-300 px-2 py-1.5"
                        />
                    </label>
                    <label className="text-sm text-slate-700">
                        Até
                        <input
                            type="date"
                            value={to}
                            onChange={(event) => setTo(event.target.value)}
                            className="mt-1 block rounded-md border border-slate-300 px-2 py-1.5"
                        />
                    </label>
                    <Button onClick={refresh} disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Atualizar
                    </Button>
                    <label className="ml-auto flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={hideSent} onChange={(event) => setHideSent(event.target.checked)} />
                        Esconder já enviados
                    </label>
                </div>

                <details>
                    <summary className="cursor-pointer text-sm font-medium text-slate-700">Editar mensagem</summary>
                    <textarea
                        value={message}
                        onChange={(event) => updateMessage(event.target.value)}
                        rows={6}
                        className="mt-2 w-full rounded-md border border-slate-300 p-2 text-sm"
                    />
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                        <span>
                            Use {'{nome}'}, {'{checkin}'} e {'{link}'}. Fica salva só neste navegador.
                        </span>
                        <button type="button" className="underline" onClick={() => updateMessage(DEFAULT_CHECKIN_MESSAGE)}>
                            Voltar ao texto padrão
                        </button>
                    </div>
                </details>
            </Card>

            {error && (
                <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {error}
                </div>
            )}

            {diagnostics && diagnostics.units > 0 && diagnostics.withLink === 0 && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    O Hospedin não devolveu o link do check-in online em nenhuma reserva. Pode ser que o plano não tenha o
                    módulo Jornada do Hóspede ou que o check-in online esteja desativado.
                </div>
            )}

            {listing && (
                <p className="text-sm text-slate-600">
                    {rows.length} {rows.length === 1 ? 'UH' : 'UHs'} com check-in de {formatCheckinDate(listing.from)} a{' '}
                    {formatCheckinDate(listing.to)}; {pendingCount} {pendingCount === 1 ? 'ainda sem envio' : 'ainda sem envio'}.
                </p>
            )}

            <div className="space-y-3">
                {visibleRows.map((row) => {
                    const url = whatsappUrl(row);
                    const sentAt = sent[row.key];
                    const blocker = !row.phone
                        ? row.phoneIssue
                        : !row.checkinUrl
                          ? 'Hospedin não devolveu o link do check-in desta reserva'
                          : null;

                    return (
                        <Card key={row.key} className="flex flex-wrap items-center gap-3 p-4">
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-medium text-slate-900">{row.guestName}</p>
                                <p className="text-sm text-slate-600">
                                    {formatCheckinDate(row.checkIn)} a {formatCheckinDate(row.checkOut)} · {row.adults} adulto(s)
                                    {row.children > 0 ? ` e ${row.children} criança(s)` : ''}
                                    {row.status === 'pre_reservation' ? ' · pré-reserva' : ''}
                                </p>
                                <p className="text-xs text-slate-500">
                                    {row.phone ? `+${row.phone}` : ''}
                                    {sentAt ? `${row.phone ? ' · ' : ''}enviado em ${new Date(sentAt).toLocaleString('pt-BR')}` : ''}
                                </p>
                                {blocker && <p className="mt-1 text-xs text-amber-700">{blocker}</p>}
                            </div>

                            {url ? (
                                <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => markSent(row.key)}
                                    className="inline-flex items-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
                                >
                                    <MessageCircle className="h-4 w-4" />
                                    {sentAt ? 'Enviar de novo' : 'Enviar no WhatsApp'}
                                </a>
                            ) : (
                                <span className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-500">Sem envio possível</span>
                            )}

                            {sentAt ? (
                                <Button variant="outline" size="sm" onClick={() => unmarkSent(row.key)}>
                                    <Undo2 className="mr-1 h-4 w-4" /> Desfazer
                                </Button>
                            ) : (
                                <Button variant="outline" size="sm" onClick={() => markSent(row.key)}>
                                    <Check className="mr-1 h-4 w-4" /> Já enviei
                                </Button>
                            )}
                        </Card>
                    );
                })}

                {listing && visibleRows.length === 0 && !loading && (
                    <p className="text-sm text-slate-500">Nenhuma reserva pendente de envio neste período.</p>
                )}
            </div>

            <p className="text-xs text-slate-500">
                &ldquo;Enviado&rdquo; é lembrado só neste navegador. O link do check-in é pessoal de cada hóspede: mande apenas
                para o telefone da reserva.
            </p>
        </div>
    );
}
