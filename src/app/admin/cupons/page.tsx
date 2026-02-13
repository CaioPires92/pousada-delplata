'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './cupons.module.css';

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

const emptyForm = (): CouponForm => ({
    name: '',
    code: '',
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

function toDatetimeLocal(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (v: number) => String(v).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
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
    const loadAttempts = useCallback(async () => {
        try {
            setAttemptsLoading(true);

            const params = new URLSearchParams();
            params.set('limit', '80');
            if (attemptResultFilter) params.set('result', attemptResultFilter);
            if (attemptReasonFilter) params.set('reason', attemptReasonFilter);
            if (attemptDaysFilter) params.set('days', attemptDaysFilter);

            const res = await fetch('/api/admin/coupons/attempts?' + params.toString());
            if (res.status === 401) {
                router.push('/admin/login');
                return;
            }
            if (!res.ok) throw new Error('Erro ao carregar tentativas de cupom');

            const data = await res.json();
            setAttempts(Array.isArray(data?.attempts) ? data.attempts : []);
        } catch (error) {
            console.error(error);
            alert('Falha ao carregar auditoria de cupons.');
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
                router.push('/admin/login');
                return;
            }

            if (!couponRes.ok) throw new Error('Erro ao carregar cupons');
            if (!roomRes.ok) throw new Error('Erro ao carregar quartos');
            if (!templateRes.ok) throw new Error('Erro ao carregar modelos de cupons');
            if (!metricsRes.ok) throw new Error('Erro ao carregar metricas de cupons');

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
            alert('Falha ao carregar cupons.');
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    useEffect(() => {
        void loadAttempts();
    }, [loadAttempts]);

    const openCreate = () => {
        setForm(emptyForm());
        setFormOpen(true);
    };
    const openCreateFromTemplate = (template: CouponTemplate) => {
        const payload = template.payload;
        setForm({
            ...emptyForm(),
            name: payload.name,
            code: '',
            generateCode: payload.generateCode,
            type: payload.type,
            value: String(payload.value),
            maxDiscountAmount: payload.maxDiscountAmount == null ? '' : String(payload.maxDiscountAmount),
            minBookingValue: payload.minBookingValue == null ? '' : String(payload.minBookingValue),
            startsAt: toDatetimeLocal(payload.startsAt),
            endsAt: toDatetimeLocal(payload.endsAt),
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
        setForm({
            id: coupon.id,
            name: coupon.name,
            code: '',
            generateCode: false,
            type: coupon.type,
            value: String(coupon.value),
            maxDiscountAmount: coupon.maxDiscountAmount == null ? '' : String(coupon.maxDiscountAmount),
            minBookingValue: coupon.minBookingValue == null ? '' : String(coupon.minBookingValue),
            startsAt: toDatetimeLocal(coupon.startsAt),
            endsAt: toDatetimeLocal(coupon.endsAt),
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
        if (!form.name.trim()) {
            alert('Nome obrigatorio.');
            return;
        }

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
            allowedSources: form.allowedSources
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
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
            if (!res.ok) {
                alert((data as any)?.error || 'Erro ao salvar cupom');
                return;
            }

            if (!isEdit && (data as any).createdCode) {
                setCreatedCode(String((data as any).createdCode));
            } else {
                setCreatedCode('');
            }

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

    if (loading) return <div>Carregando cupons...</div>;

    return (
        <>
            <div className={styles.pageHeader}>
                <h2>Cupons de Desconto ({coupons.length})</h2>
                <button onClick={openCreate} className={styles.primaryButton}>+ Novo cupom</button>
            </div>

            {createdCode ? (
                <div className={styles.alert}>Cupom criado com sucesso. Codigo: <strong>{createdCode}</strong></div>
            ) : null}
            {templates.length > 0 ? (
                <div className={styles.templateSection}>
                    <h3>Modelos antifraude</h3>
                    <div className={styles.templateGrid}>
                        {templates.map((template) => (
                            <div key={template.id} className={styles.templateCard}>
                                <div className={styles.templateHead}>
                                    <strong>{template.name}</strong>
                                    <span className={template.antifraudLevel === 'HIGH' ? styles.badgeOn : styles.badgeOff}>
                                        {template.antifraudLevel}
                                    </span>
                                </div>
                                <p>{template.description}</p>
                                <button className={styles.secondaryButton} onClick={() => openCreateFromTemplate(template)}>
                                    Usar modelo
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}


            {metrics ? (
                <div className={styles.metricsGrid}>
                    <div className={styles.metricCard}>
                        <span>Cupons ativos</span>
                        <strong>{metrics.inventory.activeCoupons}/{metrics.inventory.totalCoupons}</strong>
                    </div>
                    <div className={styles.metricCard}>
                        <span>Usos confirmados</span>
                        <strong>{metrics.redemptions.confirmed}</strong>
                    </div>
                    <div className={styles.metricCard}>
                        <span>Tentativas invalidas (7d)</span>
                        <strong>{metrics.attempts.last7d.invalid}</strong>
                    </div>
                    <div className={styles.metricCard}>
                        <span>Bloqueios antifraude (7d)</span>
                        <strong>{metrics.attempts.last7d.blocked}</strong>
                    </div>
                </div>
            ) : null}
            <div className={styles.tableWrap}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Codigo</th>
                            <th>Desconto</th>
                            <th>Status</th>
                            <th>Periodo</th>
                            <th>Usos</th>
                            <th>Acoes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {coupons.map((coupon) => (
                            <tr key={coupon.id}>
                                <td>{coupon.name}</td>
                                <td>{coupon.codePrefix}******</td>
                                <td>
                                    {coupon.type === 'PERCENT' ? `${coupon.value}%` : `R$ ${coupon.value}`}
                                </td>
                                <td>
                                    <span className={coupon.active ? styles.badgeOn : styles.badgeOff}>
                                        {coupon.active ? 'ATIVO' : 'INATIVO'}
                                    </span>
                                </td>
                                <td>
                                    <div>{coupon.startsAt ? new Date(coupon.startsAt).toLocaleDateString('pt-BR') : '-'}</div>
                                    <div>{coupon.endsAt ? new Date(coupon.endsAt).toLocaleDateString('pt-BR') : '-'}</div>
                                </td>
                                <td>{coupon._count?.redemptions || 0}</td>
                                <td>
                                    <div className={styles.actions}>
                                        <button className={styles.secondaryButton} onClick={() => openEdit(coupon)}>
                                            Editar
                                        </button>
                                        {coupon.active ? (
                                            <button className={styles.dangerButton} onClick={() => deactivateCoupon(coupon.id)}>
                                                Desativar
                                            </button>
                                        ) : null}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className={styles.auditHeader}>
                <h3>Auditoria de Tentativas</h3>
                <div className={styles.auditFilters}>
                    <select value={attemptResultFilter} onChange={(e) => setAttemptResultFilter(e.target.value)}>
                        <option value="">Todos resultados</option>
                        <option value="VALID">VALID</option>
                        <option value="INVALID">INVALID</option>
                    </select>
                    <select value={attemptReasonFilter} onChange={(e) => setAttemptReasonFilter(e.target.value)}>
                        <option value="">Todos motivos</option>
                        <option value="TOO_MANY_ATTEMPTS">TOO_MANY_ATTEMPTS</option>
                        <option value="INVALID_CODE">INVALID_CODE</option>
                        <option value="EXPIRED">EXPIRED</option>
                        <option value="NOT_STARTED">NOT_STARTED</option>
                        <option value="MIN_BOOKING_NOT_REACHED">MIN_BOOKING_NOT_REACHED</option>
                        <option value="USAGE_LIMIT_REACHED">USAGE_LIMIT_REACHED</option>
                    </select>
                    <select value={attemptDaysFilter} onChange={(e) => setAttemptDaysFilter(e.target.value)}>
                        <option value="1">Ultimo 1 dia</option>
                        <option value="7">Ultimos 7 dias</option>
                        <option value="30">Ultimos 30 dias</option>
                    </select>
                    <button className={styles.secondaryButton} onClick={() => void loadAttempts()} disabled={attemptsLoading}>
                        {attemptsLoading ? 'Atualizando...' : 'Atualizar'}
                    </button>
                </div>
            </div>


            {metrics ? (
                <div className={styles.metricsGrid}>
                    <div className={styles.metricCard}>
                        <span>Cupons ativos</span>
                        <strong>{metrics.inventory.activeCoupons}/{metrics.inventory.totalCoupons}</strong>
                    </div>
                    <div className={styles.metricCard}>
                        <span>Usos confirmados</span>
                        <strong>{metrics.redemptions.confirmed}</strong>
                    </div>
                    <div className={styles.metricCard}>
                        <span>Tentativas invalidas (7d)</span>
                        <strong>{metrics.attempts.last7d.invalid}</strong>
                    </div>
                    <div className={styles.metricCard}>
                        <span>Bloqueios antifraude (7d)</span>
                        <strong>{metrics.attempts.last7d.blocked}</strong>
                    </div>
                </div>
            ) : null}
            <div className={styles.tableWrap}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Cupom</th>
                            <th>Prefixo</th>
                            <th>Resultado</th>
                            <th>Motivo</th>
                            <th>Email</th>
                            <th>IP Hash</th>
                        </tr>
                    </thead>
                    <tbody>
                        {attempts.length === 0 ? (
                            <tr>
                                <td colSpan={7}>Nenhuma tentativa encontrada para os filtros atuais.</td>
                            </tr>
                        ) : attempts.map((attempt) => (
                            <tr key={attempt.id}>
                                <td>{new Date(attempt.createdAt).toLocaleString('pt-BR')}</td>
                                <td>{attempt.coupon?.name || '-'}</td>
                                <td>{attempt.codePrefix || '-'}</td>
                                <td>{attempt.result}</td>
                                <td>{attempt.reason || '-'}</td>
                                <td>{attempt.guestEmail || '-'}</td>
                                <td>{attempt.ipHash ? `${attempt.ipHash.slice(0, 12)}...` : '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {formOpen ? (
                <div className={styles.modal}>
                    <div className={styles.modalContent}>
                        <h3>{isEdit ? 'Editar cupom' : 'Novo cupom'}</h3>
                        <div className={styles.grid}>
                            <div className={styles.field}>
                                <label>Nome</label>
                                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                            </div>
                            <div className={styles.field}>
                                <label>Tipo</label>
                                <select
                                    value={form.type}
                                    onChange={(e) => setForm({ ...form, type: e.target.value as 'PERCENT' | 'FIXED' })}
                                >
                                    <option value="PERCENT">Percentual</option>
                                    <option value="FIXED">Valor fixo</option>
                                </select>
                            </div>
                            <div className={styles.field}>
                                <label>Valor</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.value}
                                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                                />
                            </div>
                            <div className={styles.field}>
                                <label>Codigo (opcional)</label>
                                <input
                                    value={form.code}
                                    onChange={(e) => setForm({ ...form, code: e.target.value, generateCode: false })}
                                    placeholder={isEdit ? 'Preencher so para trocar codigo' : 'Ex: VIP10'}
                                />
                            </div>
                            {!isEdit ? (
                                <div className={styles.field}>
                                    <label>Gerar codigo automatico</label>
                                    <label className={styles.checkboxRow}>
                                        <input
                                            type="checkbox"
                                            checked={form.generateCode}
                                            onChange={(e) => setForm({ ...form, generateCode: e.target.checked })}
                                        />
                                        <span>Sim</span>
                                    </label>
                                </div>
                            ) : null}
                            <div className={styles.field}>
                                <label>Min. valor reserva</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.minBookingValue}
                                    onChange={(e) => setForm({ ...form, minBookingValue: e.target.value })}
                                />
                            </div>
                            <div className={styles.field}>
                                <label>Max. desconto</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.maxDiscountAmount}
                                    onChange={(e) => setForm({ ...form, maxDiscountAmount: e.target.value })}
                                />
                            </div>
                            <div className={styles.field}>
                                <label>Inicio</label>
                                <input
                                    type="datetime-local"
                                    value={form.startsAt}
                                    onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                                />
                            </div>
                            <div className={styles.field}>
                                <label>Fim</label>
                                <input
                                    type="datetime-local"
                                    value={form.endsAt}
                                    onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                                />
                            </div>
                            <div className={styles.field}>
                                <label>Max. usos globais</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={form.maxGlobalUses}
                                    onChange={(e) => setForm({ ...form, maxGlobalUses: e.target.value })}
                                />
                            </div>
                            <div className={styles.field}>
                                <label>Max. usos por hospede</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={form.maxUsesPerGuest}
                                    onChange={(e) => setForm({ ...form, maxUsesPerGuest: e.target.value })}
                                />
                            </div>
                            <div className={styles.field}>
                                <label>Vincular email</label>
                                <input
                                    value={form.bindEmail}
                                    onChange={(e) => setForm({ ...form, bindEmail: e.target.value })}
                                />
                            </div>
                            <div className={styles.field}>
                                <label>Vincular telefone</label>
                                <input
                                    value={form.bindPhone}
                                    onChange={(e) => setForm({ ...form, bindPhone: e.target.value })}
                                />
                            </div>
                            <div className={styles.field}>
                                <label>Fontes permitidas (virgula)</label>
                                <input
                                    value={form.allowedSources}
                                    onChange={(e) => setForm({ ...form, allowedSources: e.target.value })}
                                    placeholder="direct, instagram"
                                />
                            </div>
                            <div className={styles.field}>
                                <label>Quartos permitidos</label>
                                <select
                                    multiple
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
                            </div>
                            <div className={styles.field}>
                                <label>Regras</label>
                                <label className={styles.checkboxRow}>
                                    <input
                                        type="checkbox"
                                        checked={form.active}
                                        onChange={(e) => setForm({ ...form, active: e.target.checked })}
                                    />
                                    <span>Ativo</span>
                                </label>
                                <label className={styles.checkboxRow}>
                                    <input
                                        type="checkbox"
                                        checked={form.singleUse}
                                        onChange={(e) => setForm({ ...form, singleUse: e.target.checked })}
                                    />
                                    <span>Uso unico</span>
                                </label>
                                <label className={styles.checkboxRow}>
                                    <input
                                        type="checkbox"
                                        checked={form.stackable}
                                        onChange={(e) => setForm({ ...form, stackable: e.target.checked })}
                                    />
                                    <span>Pode combinar com outro cupom</span>
                                </label>
                            </div>
                        </div>

                        <div className={styles.modalActions}>
                            <button className={styles.secondaryButton} onClick={() => setFormOpen(false)} disabled={saving}>
                                Cancelar
                            </button>
                            <button className={styles.primaryButton} onClick={submitForm} disabled={saving}>
                                {saving ? 'Salvando...' : 'Salvar'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}













