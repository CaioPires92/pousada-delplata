'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDateBR } from '@/lib/date';
import styles from './cupons.module.css';
import { 
    Tag, 
    Plus, 
    ShieldCheck, 
    BarChart3, 
    History, 
    Search, 
    Filter, 
    Trash2, 
    Edit3, 
    X, 
    Check, 
    AlertCircle, 
    ChevronRight,
    Users,
    Calendar,
    DollarSign,
    Lock
} from 'lucide-react';

type Coupon = {
    id: string;
    name: string;
    codePrefix: string;
    type: 'PERCENT' | 'FIXED';
    value: number | string;
    active: boolean;
    startsAt: string | null;
    endsAt: string | null;
    maxGlobalUses: number | null;
    maxUsesPerGuest: number | null;
    minBookingValue: number | string | null;
    maxDiscountAmount: number | string | null;
    bindEmail: string | null;
    bindPhone: string | null;
    allowedRoomTypeIds: string | null;
    allowedSources: string | null;
    singleUse: boolean;
    stackable: boolean;
    _count?: {
        redemptions: number;
        attemptLogs: number;
    };
};

type Room = { id: string; name: string };

type CouponTemplate = {
    id: 'PRIVATE_1TO1' | 'CAMPAIGN_CONTROLLED' | 'PARTNER_CHANNEL' | 'REACTIVATION';
    name: string;
    description: string;
    antifraudLevel: 'HIGH' | 'MEDIUM';
    payload: {
        name: string;
        type: 'PERCENT' | 'FIXED';
        value: number;
        generateCode: boolean;
        maxDiscountAmount: number | null;
        minBookingValue: number | null;
        startsAt: string | null;
        endsAt: string | null;
        maxGlobalUses: number | null;
        maxUsesPerGuest: number | null;
        bindEmail: string | null;
        bindPhone: string | null;
        allowedSources: string[];
        allowedRoomTypeIds: string[];
        singleUse: boolean;
        stackable: boolean;
        active: boolean;
    };
};

type CouponMetrics = {
    inventory: {
        totalCoupons: number;
        activeCoupons: number;
    };
    redemptions: {
        reserved: number;
        confirmed: number;
        released: number;
    };
    attempts: {
        last7d: {
            invalid: number;
            blocked: number;
            valid: number;
        };
        last30d: {
            invalid: number;
            blocked: number;
            valid: number;
        };
    };
};

type CouponAttempt = {
    id: string;
    codePrefix: string | null;
    guestEmail: string | null;
    ipHash: string | null;
    result: string;
    reason: string | null;
    createdAt: string;
    coupon?: {
        id: string;
        name: string;
        codePrefix: string;
    } | null;
};

type CouponForm = {
    id?: string;
    name: string;
    code: string;
    currentCodePrefix: string;
    generateCode: boolean;
    type: 'PERCENT' | 'FIXED';
    value: string;
    maxDiscountAmount: string;
    minBookingValue: string;
    startsAt: string;
    endsAt: string;
    maxGlobalUses: string;
    maxUsesPerGuest: string;
    bindEmail: string;
    bindPhone: string;
    allowedSources: string;
    allowedRoomTypeIds: string[];
    singleUse: boolean;
    stackable: boolean;
    active: boolean;
};

type CouponFormDraft = {
    formOpen: boolean;
    form: CouponForm;
    createdCode: string;
};

const COUPON_FORM_DRAFT_KEY = 'admin-coupons-form-draft-v2';

const emptyForm = (): CouponForm => ({
    name: '',
    code: '',
    currentCodePrefix: '',
    generateCode: true,
    type: 'PERCENT',
    value: '10',
    maxDiscountAmount: '',
    minBookingValue: '',
    startsAt: '',
    endsAt: '',
    maxGlobalUses: '',
    maxUsesPerGuest: '',
    bindEmail: '',
    bindPhone: '',
    allowedSources: 'direct',
    allowedRoomTypeIds: [],
    singleUse: true,
    stackable: false,
    active: true,
});

function toDateInputValue(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (v: number) => String(v).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDateOnlyBR(value: string | null): string {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return formatDateBR(value);
}

function parseJsonArray(raw: string | null): string[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map((v) => String(v));
    } catch {
        return [];
    }
    return [];
}

export default function AdminCuponsPage() {
    const router = useRouter();
    const hasHydratedDraftRef = useRef(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'gestao' | 'auditoria'>('gestao');
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [templates, setTemplates] = useState<CouponTemplate[]>([]);
    const [metrics, setMetrics] = useState<CouponMetrics | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState<CouponForm>(emptyForm());
    const [createdCode, setCreatedCode] = useState<string>('');
    const [attemptsLoading, setAttemptsLoading] = useState(false);
    const [attempts, setAttempts] = useState<CouponAttempt[]>([]);
    const [attemptResultFilter, setAttemptResultFilter] = useState('');
    const [attemptReasonFilter, setAttemptReasonFilter] = useState('');
    const [attemptDaysFilter, setAttemptDaysFilter] = useState('7');

    const isEdit = useMemo(() => Boolean(form.id), [form.id]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const rawDraft = window.localStorage.getItem(COUPON_FORM_DRAFT_KEY);
            if (!rawDraft) return;
            const parsed = JSON.parse(rawDraft) as Partial<CouponFormDraft>;
            if (!parsed || typeof parsed !== 'object' || !parsed.form || typeof parsed.form !== 'object') return;

            setForm({
                ...emptyForm(),
                ...parsed.form,
                currentCodePrefix: typeof parsed.form.currentCodePrefix === 'string' ? parsed.form.currentCodePrefix : '',
                allowedRoomTypeIds: Array.isArray(parsed.form.allowedRoomTypeIds) ? parsed.form.allowedRoomTypeIds : [],
            });
            setCreatedCode(typeof parsed.createdCode === 'string' ? parsed.createdCode : '');
            setFormOpen(Boolean(parsed.formOpen));
        } catch {
            window.localStorage.removeItem(COUPON_FORM_DRAFT_KEY);
        } finally {
            hasHydratedDraftRef.current = true;
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined' || !hasHydratedDraftRef.current) return;
        if (!formOpen) {
            window.localStorage.removeItem(COUPON_FORM_DRAFT_KEY);
            return;
        }
        const draft: CouponFormDraft = { formOpen, form, createdCode };
        window.localStorage.setItem(COUPON_FORM_DRAFT_KEY, JSON.stringify(draft));
    }, [createdCode, form, formOpen]);

    const loadAttempts = useCallback(async () => {
        try {
            setAttemptsLoading(true);
            const params = new URLSearchParams();
            params.set('limit', '80');
            if (attemptResultFilter) params.set('result', attemptResultFilter);
            if (attemptReasonFilter) params.set('reason', attemptReasonFilter);
            if (attemptDaysFilter) params.set('days', attemptDaysFilter);

            const res = await fetch('/api/admin/coupons/attempts?' + params.toString());
            if (res.status === 401) { router.push('/admin/login'); return; }
            if (!res.ok) throw new Error('Erro ao carregar tentativas de cupom');
            const data = await res.json();
            setAttempts(Array.isArray(data?.attempts) ? data.attempts : []);
        } catch (error) {
            console.error(error);
        } finally {
            setAttemptsLoading(false);
        }
    }, [router, attemptResultFilter, attemptReasonFilter, attemptDaysFilter]);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [couponRes, roomRes, templateRes, metricsRes] = await Promise.all([
                fetch('/api/admin/coupons'),
                fetch('/api/admin/rooms'),
                fetch('/api/admin/coupons/templates'),
                fetch('/api/admin/coupons/metrics'),
            ]);

            if (couponRes.status === 401 || roomRes.status === 401 || templateRes.status === 401 || metricsRes.status === 401) {
                router.push('/admin/login'); return;
            }

            const couponData = await couponRes.json();
            const roomData = await roomRes.json();
            const templateData = await templateRes.json();
            const metricsData = await metricsRes.json();

            setCoupons(Array.isArray(couponData) ? couponData : []);
            setRooms(Array.isArray(roomData) ? roomData : []);
            setTemplates(Array.isArray(templateData?.templates) ? templateData.templates : []);
            setMetrics(metricsData || null);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => { void loadData(); }, [loadData]);
    useEffect(() => { if (activeTab === 'auditoria') void loadAttempts(); }, [activeTab, loadAttempts]);

    const openCreate = () => {
        setForm(emptyForm());
        setCreatedCode('');
        setFormOpen(true);
    };

    const openCreateFromTemplate = (template: CouponTemplate) => {
        const payload = template.payload;
        setForm({
            ...emptyForm(),
            name: payload.name,
            code: '',
            currentCodePrefix: '',
            generateCode: payload.generateCode,
            type: payload.type,
            value: String(payload.value),
            maxDiscountAmount: payload.maxDiscountAmount == null ? '' : String(payload.maxDiscountAmount),
            minBookingValue: payload.minBookingValue == null ? '' : String(payload.minBookingValue),
            startsAt: toDateInputValue(payload.startsAt),
            endsAt: toDateInputValue(payload.endsAt),
            maxGlobalUses: payload.maxGlobalUses == null ? '' : String(payload.maxGlobalUses),
            maxUsesPerGuest: payload.maxUsesPerGuest == null ? '' : String(payload.maxUsesPerGuest),
            bindEmail: payload.bindEmail || '',
            bindPhone: payload.bindPhone || '',
            allowedSources: Array.isArray(payload.allowedSources) ? payload.allowedSources.join(', ') : '',
            allowedRoomTypeIds: Array.isArray(payload.allowedRoomTypeIds) ? payload.allowedRoomTypeIds : [],
            singleUse: payload.singleUse,
            stackable: payload.stackable,
            active: payload.active,
        });
        setCreatedCode('');
        setFormOpen(true);
    };

    const openEdit = (coupon: Coupon) => {
        setCreatedCode('');
        setForm({
            id: coupon.id,
            name: coupon.name,
            code: '',
            currentCodePrefix: coupon.codePrefix,
            generateCode: false,
            type: coupon.type,
            value: String(coupon.value),
            maxDiscountAmount: coupon.maxDiscountAmount == null ? '' : String(coupon.maxDiscountAmount),
            minBookingValue: coupon.minBookingValue == null ? '' : String(coupon.minBookingValue),
            startsAt: toDateInputValue(coupon.startsAt),
            endsAt: toDateInputValue(coupon.endsAt),
            maxGlobalUses: coupon.maxGlobalUses == null ? '' : String(coupon.maxGlobalUses),
            maxUsesPerGuest: coupon.maxUsesPerGuest == null ? '' : String(coupon.maxUsesPerGuest),
            bindEmail: coupon.bindEmail || '',
            bindPhone: coupon.bindPhone || '',
            allowedSources: parseJsonArray(coupon.allowedSources).join(', '),
            allowedRoomTypeIds: parseJsonArray(coupon.allowedRoomTypeIds),
            singleUse: coupon.singleUse,
            stackable: coupon.stackable,
            active: coupon.active,
        });
        setFormOpen(true);
    };

    const submitForm = async () => {
        if (!form.name.trim()) return alert('Nome obrigatorio.');
        const payload = {
            name: form.name.trim(),
            code: form.code.trim() || undefined,
            generateCode: form.generateCode,
            type: form.type,
            value: Number(form.value),
            maxDiscountAmount: form.maxDiscountAmount === '' ? null : Number(form.maxDiscountAmount),
            minBookingValue: form.minBookingValue === '' ? null : Number(form.minBookingValue),
            startsAt: form.startsAt || null,
            endsAt: form.endsAt || null,
            maxGlobalUses: form.maxGlobalUses === '' ? null : Number(form.maxGlobalUses),
            maxUsesPerGuest: form.maxUsesPerGuest === '' ? null : Number(form.maxUsesPerGuest),
            bindEmail: form.bindEmail || null,
            bindPhone: form.bindPhone || null,
            allowedSources: form.allowedSources.split(',').map((s) => s.trim()).filter(Boolean),
            allowedRoomTypeIds: form.allowedRoomTypeIds,
            singleUse: form.singleUse,
            stackable: form.stackable,
            active: form.active,
        };

        try {
            setSaving(true);
            const endpoint = isEdit ? `/api/admin/coupons/${form.id}` : '/api/admin/coupons';
            const method = isEdit ? 'PUT' : 'POST';
            const res = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return alert((data as any)?.error || 'Erro ao salvar cupom');

            const savedCode = String((data as any).createdCode || (data as any).updatedCode || '');
            setCreatedCode(savedCode);
            setFormOpen(false);
            await Promise.all([loadData(), loadAttempts()]);
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar cupom.');
        } finally {
            setSaving(false);
        }
    };

    const deactivateCoupon = async (couponId: string) => {
        if (!confirm('Desativar este cupom?')) return;
        try {
            const res = await fetch(`/api/admin/coupons/${couponId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Falha ao desativar');
            await Promise.all([loadData(), loadAttempts()]);
        } catch (error) {
            console.error(error);
            alert('Erro ao desativar cupom.');
        }
    };

    if (loading) return <div className="flex items-center justify-center min-h-[400px] text-slate-500">Carregando painel de cupons...</div>;

    return (
        <div className="pb-10">
            {/* Header */}
            <div className={styles.pageHeader}>
                <div className={styles.headerInfo}>
                    <h2>Gestão de Cupons</h2>
                    <p>Controle descontos, campanhas e auditoria de tentativas maliciosas.</p>
                </div>
                <button onClick={openCreate} className={styles.primaryButton}>
                    <Plus size={20} />
                    Novo Cupom
                </button>
            </div>

            {/* Alert code */}
            {createdCode && (
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 animate-in fade-in slide-in-from-top-4">
                    <Check className="bg-emerald-500 text-white rounded-full p-1" size={24} />
                    <div>
                        <p className="font-bold">Cupom salvo com sucesso!</p>
                        <p className="text-sm opacity-90">Código gerado: <span className="font-mono bg-emerald-100 px-2 py-0.5 rounded">{createdCode}</span></p>
                    </div>
                    <button onClick={() => setCreatedCode('')} className="ml-auto hover:bg-emerald-100 p-1 rounded">
                        <X size={18} />
                    </button>
                </div>
            )}

            {/* Tabs */}
            <div className={styles.tabs}>
                <button 
                    className={`${styles.tab} ${activeTab === 'gestao' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('gestao')}
                >
                    <Tag size={18} className="inline mr-2" />
                    Gestão de Cupons
                </button>
                <button 
                    className={`${styles.tab} ${activeTab === 'auditoria' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('auditoria')}
                >
                    <ShieldCheck size={18} className="inline mr-2" />
                    Auditoria de Segurança
                </button>
            </div>

            {/* Metrics Grid */}
            <div className={styles.metricsGrid}>
                <div className={styles.metricCard}>
                    <div className={styles.metricIcon} style={{ color: 'var(--primary)' }}>
                        <Tag size={22} />
                    </div>
                    <div className={styles.metricInfo}>
                        <span className={styles.metricLabel}>Cupons Ativos</span>
                        <strong className={styles.metricValue}>{metrics?.inventory.activeCoupons}/{metrics?.inventory.totalCoupons}</strong>
                    </div>
                </div>
                <div className={styles.metricCard}>
                    <div className={styles.metricIcon} style={{ color: 'var(--success)' }}>
                        <Check size={22} />
                    </div>
                    <div className={styles.metricInfo}>
                        <span className={styles.metricLabel}>Usos Confirmados</span>
                        <strong className={styles.metricValue}>{metrics?.redemptions.confirmed || 0}</strong>
                    </div>
                </div>
                <div className={styles.metricCard}>
                    <div className={styles.metricIcon} style={{ color: 'var(--warning)' }}>
                        <AlertCircle size={22} />
                    </div>
                    <div className={styles.metricInfo}>
                        <span className={styles.metricLabel}>Tentativas Inválidas (7d)</span>
                        <strong className={styles.metricValue}>{metrics?.attempts.last7d.invalid || 0}</strong>
                    </div>
                </div>
                <div className={styles.metricCard}>
                    <div className={styles.metricIcon} style={{ color: 'var(--danger)' }}>
                        <Lock size={22} />
                    </div>
                    <div className={styles.metricInfo}>
                        <span className={styles.metricLabel}>Bloqueios (7d)</span>
                        <strong className={styles.metricValue}>{metrics?.attempts.last7d.blocked || 0}</strong>
                    </div>
                </div>
            </div>

            {activeTab === 'gestao' ? (
                <>
                    {/* Templates Section */}
                    {templates.length > 0 && (
                        <div className={styles.templateSection}>
                            <h3>
                                <BarChart3 size={20} />
                                Modelos Antifraude
                            </h3>
                            <div className={styles.templateGrid}>
                                {templates.map((template) => (
                                    <div key={template.id} className={styles.templateCard}>
                                        <div className={styles.templateHead}>
                                            <strong>{template.name}</strong>
                                            <span className={`${styles.badge} ${template.antifraudLevel === 'HIGH' ? styles.badgeDanger : styles.badgeWarning}`}>
                                                {template.antifraudLevel}
                                            </span>
                                        </div>
                                        <p>{template.description}</p>
                                        <button 
                                            className={styles.secondaryButton} 
                                            onClick={() => openCreateFromTemplate(template)}
                                            style={{ padding: '0.5rem', width: '100%', fontSize: '0.85rem' }}
                                        >
                                            Usar modelo
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Main Table */}
                    <div className={styles.tableContainer}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Nome</th>
                                    <th>Código</th>
                                    <th>Desconto</th>
                                    <th>Status</th>
                                    <th>Período</th>
                                    <th>Usos</th>
                                    <th className="text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {coupons.map((coupon) => (
                                    <tr key={coupon.id}>
                                        <td className="font-bold">{coupon.name}</td>
                                        <td>
                                            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">
                                                {coupon.codePrefix}******
                                            </code>
                                        </td>
                                        <td>
                                            <span className="font-medium text-slate-900">
                                                {coupon.type === 'PERCENT' ? `${coupon.value}%` : `R$ ${coupon.value}`}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`${styles.badge} ${coupon.active ? styles.badgeSuccess : styles.badgeInfo}`}>
                                                {coupon.active ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>
                                        <td className="text-xs text-slate-500">
                                            <div className="flex items-center gap-1"><Calendar size={12} /> {formatDateOnlyBR(coupon.startsAt)}</div>
                                            <div className="flex items-center gap-1 mt-1 opacity-60"><ChevronRight size={12} /> {formatDateOnlyBR(coupon.endsAt)}</div>
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-1.5">
                                                <Users size={14} className="text-slate-400" />
                                                {coupon._count?.redemptions || 0}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex justify-end gap-2">
                                                <button className={styles.secondaryButton} style={{ padding: '0.4rem' }} onClick={() => openEdit(coupon)}>
                                                    <Edit3 size={16} />
                                                </button>
                                                {coupon.active && (
                                                    <button className={styles.dangerButton} style={{ padding: '0.4rem' }} onClick={() => deactivateCoupon(coupon.id)}>
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Audit Filters */}
                    <div className={styles.auditFilters}>
                        <div className={styles.filterGroup}>
                            <label>Resultado</label>
                            <select className={styles.input} value={attemptResultFilter} onChange={(e) => setAttemptResultFilter(e.target.value)}>
                                <option value="">Todos os resultados</option>
                                <option value="VALID">Válidos</option>
                                <option value="INVALID">Inválidos</option>
                            </select>
                        </div>
                        <div className={styles.filterGroup}>
                            <label>Motivo do Bloqueio</label>
                            <select className={styles.input} value={attemptReasonFilter} onChange={(e) => setAttemptReasonFilter(e.target.value)}>
                                <option value="">Todos os motivos</option>
                                <option value="TOO_MANY_ATTEMPTS">Muitas tentativas</option>
                                <option value="INVALID_CODE">Código inválido</option>
                                <option value="EXPIRED">Expirado</option>
                                <option value="NOT_STARTED">Não iniciado</option>
                                <option value="MIN_BOOKING_NOT_REACHED">Valor mínimo</option>
                                <option value="USAGE_LIMIT_REACHED">Limite atingido</option>
                            </select>
                        </div>
                        <div className={styles.filterGroup}>
                            <label>Período</label>
                            <select className={styles.input} value={attemptDaysFilter} onChange={(e) => setAttemptDaysFilter(e.target.value)}>
                                <option value="1">Últimas 24h</option>
                                <option value="7">Últimos 7 dias</option>
                                <option value="30">Últimos 30 dias</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <button className={styles.primaryButton} onClick={() => void loadAttempts()} disabled={attemptsLoading}>
                                <Filter size={18} />
                                {attemptsLoading ? 'Filtrando...' : 'Filtrar'}
                            </button>
                        </div>
                    </div>

                    {/* Audit Table */}
                    <div className={styles.tableContainer}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Data / Hora</th>
                                    <th>Cupom Tentado</th>
                                    <th>Prefixo</th>
                                    <th>Resultado</th>
                                    <th>Motivo</th>
                                    <th>Email / IP</th>
                                </tr>
                            </thead>
                            <tbody>
                                {attempts.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-10 text-slate-400">Nenhuma tentativa encontrada para os filtros atuais.</td>
                                    </tr>
                                ) : attempts.map((attempt) => (
                                    <tr key={attempt.id}>
                                        <td className="text-xs text-slate-500 whitespace-nowrap">
                                            {new Date(attempt.createdAt).toLocaleString('pt-BR')}
                                        </td>
                                        <td className="font-bold">{attempt.coupon?.name || '-'}</td>
                                        <td><code className="text-xs">{attempt.codePrefix || '-'}</code></td>
                                        <td>
                                            <span className={`${styles.badge} ${attempt.result === 'VALID' ? styles.badgeSuccess : styles.badgeDanger}`}>
                                                {attempt.result}
                                            </span>
                                        </td>
                                        <td className="text-xs text-slate-600">{attempt.reason || '-'}</td>
                                        <td className="text-xs">
                                            <div className="text-slate-700">{attempt.guestEmail || '-'}</div>
                                            <div className="text-slate-400 font-mono mt-0.5">{attempt.ipHash ? `${attempt.ipHash.slice(0, 12)}...` : '-'}</div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal */}
            {formOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h3>{isEdit ? 'Editar Cupom' : 'Criar Novo Cupom'}</h3>
                            <button onClick={() => setFormOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className={styles.modalBody}>
                            <div className={styles.formGrid}>
                                {/* Básico */}
                                <div className={styles.formSection}>
                                    <h4><Tag size={14} className="inline mr-1" /> Informações Básicas</h4>
                                </div>
                                
                                <div className={styles.field + " col-span-2"}>
                                    <label>Nome da Campanha</label>
                                    <input 
                                        className={styles.input} 
                                        placeholder="Ex: Natal Delplata 2026"
                                        value={form.name} 
                                        onChange={(e) => setForm({ ...form, name: e.target.value })} 
                                    />
                                </div>
                                
                                <div className={styles.field}>
                                    <label>Tipo de Desconto</label>
                                    <select
                                        className={styles.input}
                                        value={form.type}
                                        onChange={(e) => setForm({ ...form, type: e.target.value as 'PERCENT' | 'FIXED' })}
                                    >
                                        <option value="PERCENT">Percentual (%)</option>
                                        <option value="FIXED">Valor Fixo (R$)</option>
                                    </select>
                                </div>
                                
                                <div className={styles.field}>
                                    <label>Valor do Desconto</label>
                                    <div className="relative">
                                        <input
                                            className={styles.input + " w-full"}
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={form.value}
                                            onChange={(e) => setForm({ ...form, value: e.target.value })}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                                            {form.type === 'PERCENT' ? '%' : 'R$'}
                                        </span>
                                    </div>
                                </div>

                                <div className={styles.field}>
                                    <label>Código do Cupom</label>
                                    <input
                                        className={styles.input}
                                        value={form.code}
                                        onChange={(e) => setForm({ ...form, code: e.target.value, generateCode: false })}
                                        placeholder={isEdit ? "Manter atual" : "Ex: VERAO20"}
                                    />
                                    {isEdit && form.currentCodePrefix && (
                                        <p className="text-[10px] text-slate-400 mt-1">Prefixo atual: {form.currentCodePrefix}</p>
                                    )}
                                </div>

                                {!isEdit && (
                                    <div className={styles.field}>
                                        <label>Geração de Código</label>
                                        <label className={styles.checkboxItem}>
                                            <input
                                                type="checkbox"
                                                checked={form.generateCode}
                                                onChange={(e) => setForm({ ...form, generateCode: e.target.checked })}
                                            />
                                            <span className="text-sm font-medium">Gerar código aleatório</span>
                                        </label>
                                    </div>
                                )}

                                {/* Limites */}
                                <div className={styles.formSection}>
                                    <h4><Calendar size={14} className="inline mr-1" /> Prazos e Limites</h4>
                                </div>

                                <div className={styles.field}>
                                    <label>Início da Validade</label>
                                    <input
                                        className={styles.input}
                                        type="date"
                                        value={form.startsAt}
                                        onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                                    />
                                </div>

                                <div className={styles.field}>
                                    <label>Fim da Validade</label>
                                    <input
                                        className={styles.input}
                                        type="date"
                                        value={form.endsAt}
                                        onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                                    />
                                </div>

                                <div className={styles.field}>
                                    <label>Máx. Usos Globais</label>
                                    <input
                                        className={styles.input}
                                        type="number"
                                        min="0"
                                        placeholder="Ilimitado"
                                        value={form.maxGlobalUses}
                                        onChange={(e) => setForm({ ...form, maxGlobalUses: e.target.value })}
                                    />
                                </div>

                                <div className={styles.field}>
                                    <label>Máx. Usos por Hóspede</label>
                                    <input
                                        className={styles.input}
                                        type="number"
                                        min="0"
                                        placeholder="1"
                                        value={form.maxUsesPerGuest}
                                        onChange={(e) => setForm({ ...form, maxUsesPerGuest: e.target.value })}
                                    />
                                </div>

                                {/* Restrições */}
                                <div className={styles.formSection}>
                                    <h4><DollarSign size={14} className="inline mr-1" /> Regras Financeiras</h4>
                                </div>

                                <div className={styles.field}>
                                    <label>Valor Mín. da Reserva</label>
                                    <input
                                        className={styles.input}
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={form.minBookingValue}
                                        onChange={(e) => setForm({ ...form, minBookingValue: e.target.value })}
                                    />
                                </div>

                                <div className={styles.field}>
                                    <label>Desconto Máximo</label>
                                    <input
                                        className={styles.input}
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={form.maxDiscountAmount}
                                        onChange={(e) => setForm({ ...form, maxDiscountAmount: e.target.value })}
                                    />
                                </div>

                                <div className={styles.formSection}>
                                    <h4><Users size={14} className="inline mr-1" /> Restrições e Segurança</h4>
                                </div>

                                <div className={styles.field}>
                                    <label>Email Específico</label>
                                    <input
                                        className={styles.input}
                                        placeholder="ex@email.com"
                                        value={form.bindEmail}
                                        onChange={(e) => setForm({ ...form, bindEmail: e.target.value })}
                                    />
                                </div>

                                <div className={styles.field}>
                                    <label>Telefone Específico</label>
                                    <input
                                        className={styles.input}
                                        placeholder="(00) 00000-0000"
                                        value={form.bindPhone}
                                        onChange={(e) => setForm({ ...form, bindPhone: e.target.value })}
                                    />
                                </div>

                                <div className={styles.field}>
                                    <label>Canais Permitidos</label>
                                    <input
                                        className={styles.input}
                                        value={form.allowedSources}
                                        onChange={(e) => setForm({ ...form, allowedSources: e.target.value })}
                                        placeholder="direct, instagram, facebook"
                                    />
                                </div>

                                <div className={styles.field}>
                                    <label>Acomodações Permitidas</label>
                                    <select
                                        multiple
                                        className={styles.input + " h-24"}
                                        value={form.allowedRoomTypeIds}
                                        onChange={(e) => {
                                            const values = Array.from(e.target.selectedOptions).map((opt) => opt.value);
                                            setForm({ ...form, allowedRoomTypeIds: values });
                                        }}
                                    >
                                        {rooms.map((room) => (
                                            <option key={room.id} value={room.id}>
                                                {room.name}
                                            </option>
                                        ))}
                                    </select>
                                    <span className="text-[10px] text-slate-400">Pressione Ctrl/Cmd para selecionar múltiplos</span>
                                </div>

                                <div className={styles.formSection}>
                                    <h4><ShieldCheck size={14} className="inline mr-1" /> Comportamento</h4>
                                </div>

                                <div className="col-span-2">
                                    <div className={styles.checkboxGroup}>
                                        <label className={styles.checkboxItem}>
                                            <input
                                                type="checkbox"
                                                checked={form.active}
                                                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                                            />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold">Ativo</span>
                                                <span className="text-[10px] text-slate-500">Pode ser usado no motor</span>
                                            </div>
                                        </label>
                                        <label className={styles.checkboxItem}>
                                            <input
                                                type="checkbox"
                                                checked={form.singleUse}
                                                onChange={(e) => setForm({ ...form, singleUse: e.target.checked })}
                                            />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold">Uso Único</span>
                                                <span className="text-[10px] text-slate-500">Inativa após primeiro uso</span>
                                            </div>
                                        </label>
                                        <label className={styles.checkboxItem}>
                                            <input
                                                type="checkbox"
                                                checked={form.stackable}
                                                onChange={(e) => setForm({ ...form, stackable: e.target.checked })}
                                            />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold">Acumulável</span>
                                                <span className="text-[10px] text-slate-500">Usa com outros cupons</span>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={styles.modalFooter}>
                            <button className={styles.secondaryButton} onClick={() => setFormOpen(false)}>Cancelar</button>
                            <button 
                                className={styles.primaryButton} 
                                onClick={submitForm} 
                                disabled={saving}
                            >
                                {saving ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Criar Cupom'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
