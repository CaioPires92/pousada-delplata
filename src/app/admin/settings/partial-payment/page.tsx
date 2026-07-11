"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, CreditCard, RotateCcw, Save } from "lucide-react";

type BalanceDueAt = "CHECK_IN" | "BEFORE_CHECK_IN";
type PaymentMode = "FULL" | "PARTIAL";

type PartialPaymentSettings = {
    enabled: boolean;
    percentage: number;
    minimumBookingAmount: number | "";
    minimumLeadTimeDays: number | "";
    balanceDueAt: BalanceDueAt;
    balanceDueDaysBeforeCheckIn: number | "";
    defaultPaymentMode: PaymentMode;
};

const emptySettings: PartialPaymentSettings = {
    enabled: false,
    percentage: 50,
    minimumBookingAmount: "",
    minimumLeadTimeDays: "",
    balanceDueAt: "CHECK_IN",
    balanceDueDaysBeforeCheckIn: "",
    defaultPaymentMode: "FULL",
};

function formatCurrency(value: number) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(value);
}

function toFormSettings(settings: any): PartialPaymentSettings {
    return {
        enabled: Boolean(settings?.enabled),
        percentage: Number(settings?.percentage ?? 50),
        minimumBookingAmount: settings?.minimumBookingAmount == null ? "" : Number(settings.minimumBookingAmount),
        minimumLeadTimeDays: settings?.minimumLeadTimeDays == null ? "" : Number(settings.minimumLeadTimeDays),
        balanceDueAt: settings?.balanceDueAt === "BEFORE_CHECK_IN" ? "BEFORE_CHECK_IN" : "CHECK_IN",
        balanceDueDaysBeforeCheckIn: settings?.balanceDueDaysBeforeCheckIn == null ? "" : Number(settings.balanceDueDaysBeforeCheckIn),
        defaultPaymentMode: settings?.defaultPaymentMode === "PARTIAL" ? "PARTIAL" : "FULL",
    };
}

function toApiPayload(settings: PartialPaymentSettings) {
    return {
        enabled: settings.enabled,
        percentage: Number(settings.percentage),
        minimumBookingAmount: settings.minimumBookingAmount === "" ? null : Number(settings.minimumBookingAmount),
        minimumLeadTimeDays: settings.minimumLeadTimeDays === "" ? null : Number(settings.minimumLeadTimeDays),
        balanceDueAt: settings.balanceDueAt,
        balanceDueDaysBeforeCheckIn: settings.balanceDueAt === "BEFORE_CHECK_IN"
            ? (settings.balanceDueDaysBeforeCheckIn === "" ? null : Number(settings.balanceDueDaysBeforeCheckIn))
            : null,
        defaultPaymentMode: settings.defaultPaymentMode,
    };
}

export default function PartialPaymentSettingsPage() {
    const [settings, setSettings] = useState<PartialPaymentSettings>(emptySettings);
    const [savedSettings, setSavedSettings] = useState<PartialPaymentSettings>(emptySettings);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const fieldsDisabled = !settings.enabled || isSaving;
    const preview = useMemo(() => {
        const total = Math.max(0, Number(settings.minimumBookingAmount || 2000));
        const percent = Math.min(99, Math.max(1, Number(settings.percentage || 50)));
        const now = Math.round((total * percent) / 100 * 100) / 100;
        const remaining = Math.round((total - now) * 100) / 100;
        return { total, now, remaining };
    }, [settings.minimumBookingAmount, settings.percentage]);

    async function fetchSettings() {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch("/api/admin/settings/partial-payment");
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data?.error || "Erro ao carregar configurações");
            const next = toFormSettings(data.settings);
            setSettings(next);
            setSavedSettings(next);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erro ao carregar configurações");
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        void fetchSettings();
    }, []);

    async function handleSave() {
        if (isSaving) return;
        setIsSaving(true);
        setError(null);
        setSuccess(null);
        try {
            const response = await fetch("/api/admin/settings/partial-payment", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(toApiPayload(settings)),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const firstFieldError = data?.errors ? Object.values(data.errors)[0] : null;
                throw new Error(String(firstFieldError || data?.error || "Erro ao salvar configurações"));
            }
            const next = toFormSettings(data.settings);
            setSettings(next);
            setSavedSettings(next);
            setSuccess("Configurações salvas com sucesso.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erro ao salvar configurações");
        } finally {
            setIsSaving(false);
        }
    }

    function restoreChanges() {
        setSettings(savedSettings);
        setError(null);
        setSuccess(null);
    }

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <header className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-slate-800 p-2 text-white">
                        <CreditCard size={28} />
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-800">Configurações de pagamento parcial</h1>
                </div>
                <p className="font-medium text-slate-500">Controle quando o hóspede pode pagar uma parte da reserva no checkout.</p>
            </header>

            {error ? (
                <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4 font-medium text-red-600">
                    <AlertCircle size={20} />
                    {error}
                </div>
            ) : null}
            {success ? (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4 font-medium text-emerald-700">
                    <CheckCircle2 size={20} />
                    {success}
                </div>
            ) : null}

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                {isLoading ? (
                    <div className="space-y-4">
                        <div className="h-8 w-64 animate-pulse rounded bg-slate-100" />
                        <div className="grid gap-4 md:grid-cols-2">
                            {[1, 2, 3, 4].map((item) => (
                                <div key={item} className="h-24 animate-pulse rounded-xl bg-slate-100" />
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <label className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <span>
                                <span className="block font-black text-slate-800">Habilitar pagamento parcial</span>
                                <span className="mt-1 block text-sm font-medium text-slate-500">
                                    Permite que o hóspede pague uma parte da reserva no momento da confirmação.
                                </span>
                            </span>
                            <input
                                type="checkbox"
                                checked={settings.enabled}
                                disabled={isSaving}
                                onChange={(event) => setSettings((current) => ({ ...current, enabled: event.target.checked }))}
                                className="mt-1 h-5 w-5"
                            />
                        </label>

                        <div className={fieldsDisabled ? "space-y-5 opacity-55" : "space-y-5"}>
                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="space-y-2">
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">Percentual do pagamento inicial</span>
                                    <div className="flex overflow-hidden rounded-xl border border-slate-200">
                                        <input
                                            type="number"
                                            min={1}
                                            max={99}
                                            value={settings.percentage}
                                            disabled={fieldsDisabled}
                                            onChange={(event) => setSettings((current) => ({ ...current, percentage: Number(event.target.value) }))}
                                            className="w-full px-4 py-3 font-bold outline-none"
                                        />
                                        <span className="bg-slate-100 px-4 py-3 font-bold text-slate-500">%</span>
                                    </div>
                                    <span className="block text-sm text-slate-500">Percentual do valor total cobrado no momento da reserva.</span>
                                </label>

                                <label className="space-y-2">
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">Valor mínimo da reserva</span>
                                    <input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={settings.minimumBookingAmount}
                                        disabled={fieldsDisabled}
                                        onChange={(event) => setSettings((current) => ({ ...current, minimumBookingAmount: event.target.value === "" ? "" : Number(event.target.value) }))}
                                        className="w-full rounded-xl border border-slate-200 px-4 py-3 font-bold outline-none"
                                        placeholder="Sem mínimo"
                                    />
                                    <span className="block text-sm text-slate-500">Vazio ou zero libera a regra para qualquer valor.</span>
                                </label>

                                <label className="space-y-2">
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">Antecedência mínima</span>
                                    <div className="flex overflow-hidden rounded-xl border border-slate-200">
                                        <input
                                            type="number"
                                            min={0}
                                            value={settings.minimumLeadTimeDays}
                                            disabled={fieldsDisabled}
                                            onChange={(event) => setSettings((current) => ({ ...current, minimumLeadTimeDays: event.target.value === "" ? "" : Number(event.target.value) }))}
                                            className="w-full px-4 py-3 font-bold outline-none"
                                            placeholder="Sem restrição"
                                        />
                                        <span className="bg-slate-100 px-4 py-3 font-bold text-slate-500">dias</span>
                                    </div>
                                    <span className="block text-sm text-slate-500">Reservas abaixo desse prazo exigem pagamento integral.</span>
                                </label>

                                <label className="space-y-2">
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">Opção padrão no checkout</span>
                                    <select
                                        value={settings.defaultPaymentMode}
                                        disabled={fieldsDisabled}
                                        onChange={(event) => setSettings((current) => ({ ...current, defaultPaymentMode: event.target.value as PaymentMode }))}
                                        className="w-full rounded-xl border border-slate-200 px-4 py-3 font-bold outline-none"
                                    >
                                        <option value="FULL">Pagamento integral</option>
                                        <option value="PARTIAL">Pagamento parcial</option>
                                    </select>
                                </label>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="space-y-2">
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">Pagamento do saldo</span>
                                    <select
                                        value={settings.balanceDueAt}
                                        disabled={fieldsDisabled}
                                        onChange={(event) => setSettings((current) => ({ ...current, balanceDueAt: event.target.value as BalanceDueAt }))}
                                        className="w-full rounded-xl border border-slate-200 px-4 py-3 font-bold outline-none"
                                    >
                                        <option value="CHECK_IN">No check-in</option>
                                        <option value="BEFORE_CHECK_IN">Antes do check-in</option>
                                    </select>
                                </label>

                                {settings.balanceDueAt === "BEFORE_CHECK_IN" ? (
                                    <label className="space-y-2">
                                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">Dias antes do check-in</span>
                                        <div className="flex overflow-hidden rounded-xl border border-slate-200">
                                            <input
                                                type="number"
                                                min={0}
                                                value={settings.balanceDueDaysBeforeCheckIn}
                                                disabled={fieldsDisabled}
                                                onChange={(event) => setSettings((current) => ({ ...current, balanceDueDaysBeforeCheckIn: event.target.value === "" ? "" : Number(event.target.value) }))}
                                                className="w-full px-4 py-3 font-bold outline-none"
                                            />
                                            <span className="bg-slate-100 px-4 py-3 font-bold text-slate-500">dias</span>
                                        </div>
                                    </label>
                                ) : null}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                            <h2 className="text-lg font-black text-slate-800">Pré-visualização</h2>
                            {!settings.enabled ? (
                                <p className="mt-3 font-medium text-slate-500">Pagamento parcial desabilitado. Todas as reservas exigirão pagamento integral.</p>
                            ) : (
                                <div className="mt-4 grid gap-3 text-sm font-semibold text-slate-600 md:grid-cols-2">
                                    <p>Reserva: <strong className="text-slate-900">{formatCurrency(preview.total)}</strong></p>
                                    <p>Pagamento agora: <strong className="text-slate-900">{formatCurrency(preview.now)}</strong></p>
                                    <p>Restante: <strong className="text-slate-900">{formatCurrency(preview.remaining)}</strong></p>
                                    <p>Pagamento do saldo: <strong className="text-slate-900">{settings.balanceDueAt === "CHECK_IN" ? "no check-in" : `${settings.balanceDueDaysBeforeCheckIn || 0} dia(s) antes do check-in`}</strong></p>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={restoreChanges}
                                disabled={isSaving}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                            >
                                <RotateCcw size={18} />
                                Restaurar alterações
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaving}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-5 py-3 font-black text-white transition hover:bg-slate-900 disabled:opacity-50"
                            >
                                <Save size={18} />
                                {isSaving ? "Salvando..." : "Salvar configurações"}
                            </button>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}
