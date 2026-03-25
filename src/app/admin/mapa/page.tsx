'use client';

import { Fragment, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { 
    format, 
    startOfMonth, 
    endOfMonth, 
    eachDayOfInterval, 
    startOfWeek, 
    endOfWeek, 
    isSameMonth, 
    isSameDay, 
    addMonths, 
    subMonths,
    addDays,
    parseISO,
    startOfDay,
    isValid,
    getDate
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import styles from './mapa.module.css';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { OCCUPANCY_BAND_LABEL, getOccupancyMetrics, type OccupancyBand } from './occupancy';
import InventoryStepper from './inventory-stepper';
import {
    WEEKDAYS,
    applyWeekdayPreset,
    buildBulkUpdates,
    countAffectedDays,
    defaultBulkFieldToggles,
    defaultBulkFieldValues,
    defaultWeekdays,
    getSelectedWeekdays,
    hasActiveBulkChanges,
    type BulkInventoryTarget,
    type BulkFieldToggles,
    type BulkFieldValues,
} from './bulk-edit';
import {
    getHorizontalSelection,
    getInventoryMaxAllowed,
    type InventoryField,
} from './inventory-grid';

interface RoomType {
    id: string;
    name: string;
    basePrice: number;
    inventoryFor4Guests?: number;
}

    interface CalendarData {
        date: string;
        price: number;
        stopSell: boolean;
        cta: boolean;
        ctd: boolean;
        minLos: number;
        rateId: string | null;
        totalInventory: number;
        capacityTotal: number;
        bookingsCount: number;
        available: number;
        fourGuestInventory?: number;
        fourGuestCapacityTotal?: number;
        bookingsFor4GuestsCount?: number;
        isFourGuestAdjusted?: boolean;
        isAdjusted: boolean;
    }

    // ... (keep RoomType interface)

interface EditableCellProps {
    value: number | string;
    onSave: (value: string) => void;
    type?: 'number' | 'text';
    min?: string;
}

type RateUpdatePayload = Record<string, string | number | boolean>;
type DragSelectionField = InventoryField | 'price' | 'minLos' | 'cta' | 'ctd';

type InventoryDragState = {
    roomId: string;
    field: DragSelectionField;
    startDate: string;
    currentDate: string;
    moved: boolean;
    anchorRect: { left: number; top: number; bottom: number };
};

type InventorySelectionState = {
    roomId: string;
    field: DragSelectionField;
    dates: string[];
    anchorRect: { left: number; top: number; bottom: number };
};

const ALL_ROOMS_VALUE = 'all';
const ROOM_ORDER_KEYWORDS = ['terreo', 'superior', 'chale', 'anexo'];

const normalizeRoomName = (name: string) =>
    name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

const getRoomSortPriority = (name: string) => {
    const normalized = normalizeRoomName(name);
    const idx = ROOM_ORDER_KEYWORDS.findIndex(keyword => normalized.includes(keyword));
    return idx >= 0 ? idx : ROOM_ORDER_KEYWORDS.length;
};

const isInventorySelectionField = (field: DragSelectionField): field is InventoryField =>
    field === 'inventory' || field === 'fourGuestInventory';

const isNumericSelectionField = (field: DragSelectionField) =>
    field === 'inventory' || field === 'fourGuestInventory' || field === 'price' || field === 'minLos';

const getSelectionTitle = (field: DragSelectionField, daysCount: number) => {
    const suffix = `${daysCount} ${daysCount === 1 ? 'dia' : 'dias'}`;
    switch (field) {
        case 'inventory':
            return `Aplicar quartos disponíveis em ${suffix}`;
        case 'fourGuestInventory':
            return `Aplicar quadruplo em ${suffix}`;
        case 'price':
            return `Aplicar preço em ${suffix}`;
        case 'minLos':
            return `Aplicar mínimo de noites em ${suffix}`;
        case 'cta':
            return `Aplicar bloqueio de entrada em ${suffix}`;
        case 'ctd':
            return `Aplicar bloqueio de saída em ${suffix}`;
        default:
            return `Aplicar alteração em ${suffix}`;
    }
};

const getSelectionInputLabel = (field: DragSelectionField) => {
    switch (field) {
        case 'inventory':
            return 'Valor para aplicar em lote';
        case 'fourGuestInventory':
            return 'Valor de quadruplo para aplicar em lote';
        case 'price':
            return 'Preço para aplicar em lote';
        case 'minLos':
            return 'Mínimo de noites para aplicar em lote';
        case 'cta':
            return 'Valor de CTA para aplicar em lote';
        case 'ctd':
            return 'Valor de CTD para aplicar em lote';
        default:
            return 'Valor para aplicar em lote';
    }
};

const EditableCell = ({ value, onSave, type = 'text', min }: EditableCellProps) => {
    const [currentValue, setCurrentValue] = useState(value);

    useEffect(() => {
        setCurrentValue(value);
    }, [value]);

    return (
        <input 
            type={type}
            min={min}
            className={styles.cellInput}
            value={currentValue}
            onChange={(e) => setCurrentValue(e.target.value)}
            onBlur={(e) => {
                if (e.target.value !== value.toString()) {
                    onSave(e.target.value);
                }
            }}
            onKeyDown={(e) => {
                if(e.key === 'Enter') {
                    const target = e.target as HTMLInputElement;
                    if (target.value !== value.toString()) {
                        onSave(target.value);
                    }
                    target.blur();
                }
            }}
        />
    );
};

export default function MapaReservas() {
    const router = useRouter();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
    const [selectedRoomId, setSelectedRoomId] = useState<string>(ALL_ROOMS_VALUE);
    const [periodMode, setPeriodMode] = useState<'month' | 'custom'>('month');
    const [customStart, setCustomStart] = useState(() => format(startOfDay(new Date()), 'yyyy-MM-dd'));
    const [customEnd, setCustomEnd] = useState(() => format(addDays(startOfDay(new Date()), 30), 'yyyy-MM-dd'));
    const [collapsedRooms, setCollapsedRooms] = useState<Record<string, boolean>>({});
    const [calendarData, setCalendarData] = useState<CalendarData[]>([]);
    const [calendarDataByRoom, setCalendarDataByRoom] = useState<Record<string, CalendarData[]>>({});
    const [calendarLoading, setCalendarLoading] = useState(false);
    const [calendarError, setCalendarError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
    // List View Scroll Ref
    const listScrollRef = useRef<HTMLDivElement>(null);
    const hasAutoCenteredTodayRef = useRef(false);
    const [isListDragging, setIsListDragging] = useState(false);
    const listDragStateRef = useRef({ isDragging: false, startX: 0, startScrollLeft: 0 });

    const [loading, setLoading] = useState(true);

    const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
        setToast({ type, message });
        window.setTimeout(() => setToast(null), 2800);
    }, []);
    
    // Modal state (for Grid)
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [editPrice, setEditPrice] = useState('');
    const [editMinLos, setEditMinLos] = useState('');
    const [editInventory, setEditInventory] = useState('');
    const [editStopSell, setEditStopSell] = useState(false);
    const [editCta, setEditCta] = useState(false);
    const [editCtd, setEditCtd] = useState(false);
    const [existingRateId, setExistingRateId] = useState<string | null>(null);

    // Bulk Edit State
    const [bulkModalOpen, setBulkModalOpen] = useState(false);
    const [bulkRoomTypeId, setBulkRoomTypeId] = useState('all');
    const [bulkStart, setBulkStart] = useState('');
    const [bulkEnd, setBulkEnd] = useState('');
    const [bulkFieldValues, setBulkFieldValues] = useState<BulkFieldValues>(defaultBulkFieldValues);
    const [bulkFieldToggles, setBulkFieldToggles] = useState<BulkFieldToggles>(defaultBulkFieldToggles);
    const [bulkInventoryTarget, setBulkInventoryTarget] = useState<BulkInventoryTarget>('standard');
    const [bulkWeekdays, setBulkWeekdays] = useState<Record<number, boolean>>(defaultWeekdays);
    const [inventoryDragState, setInventoryDragState] = useState<InventoryDragState | null>(null);
    const [inventorySelection, setInventorySelection] = useState<InventorySelectionState | null>(null);
    const [inventoryBatchValue, setInventoryBatchValue] = useState('');
    const [inventoryBatchSaving, setInventoryBatchSaving] = useState(false);
    const toggleWeekday = (day: number) => {
        setBulkWeekdays(prev => ({ ...prev, [day]: !prev[day] }));
    };
    const resetBulkWeekdays = () => setBulkWeekdays(defaultWeekdays());
    const setBulkFieldValue = <K extends keyof BulkFieldValues>(field: K, value: BulkFieldValues[K]) => {
        setBulkFieldValues(prev => ({ ...prev, [field]: value }));
    };
    const toggleBulkField = (field: keyof BulkFieldToggles) => {
        setBulkFieldToggles(prev => ({ ...prev, [field]: !prev[field] }));
    };

    useEffect(() => {
        fetchRoomTypes();
    }, [router]);

    const fetchRoomTypes = async () => {
        try {
            const res = await fetch('/api/rooms');
            const data = await res.json();
            if (Array.isArray(data)) {
                const orderedRooms = [...data].sort((a, b) => {
                    const priorityDiff = getRoomSortPriority(a.name) - getRoomSortPriority(b.name);
                    if (priorityDiff !== 0) return priorityDiff;
                    return normalizeRoomName(a.name).localeCompare(normalizeRoomName(b.name), 'pt-BR');
                });

                setRoomTypes(orderedRooms);
                setSelectedRoomId(prev => prev || ALL_ROOMS_VALUE);
            }
        } catch (error) {
            console.error('Error loading rooms:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCalendarForRoom = useCallback(async (roomTypeId: string, startKey: string, endKey: string) => {
        const res = await fetch(`/api/admin/calendar?roomTypeId=${roomTypeId}&startDate=${startKey}&endDate=${endKey}&_t=${Date.now()}`, {
            cache: 'no-store'
        });

        if (!res.ok) {
            const contentType = res.headers.get('content-type') || '';
            let message = `Erro ao carregar calendário (HTTP ${res.status})`;
            if (contentType.includes('application/json')) {
                const data = await res.json().catch(() => null);
                if (data && typeof data === 'object') {
                    if (typeof (data as any).message === 'string') message = (data as any).message;
                    else if (typeof (data as any).error === 'string') message = (data as any).error;
                }
            } else {
                const responseText = await res.text().catch(() => '');
                if (responseText) message = responseText;
            }
            throw new Error(message);
        }

        const data = await res.json();
        if (!Array.isArray(data)) {
            throw new Error('Resposta inválida da API do calendário');
        }

        return data as CalendarData[];
    }, []);

    const today = useMemo(() => startOfDay(new Date()), []);

    const listQueryInterval = useMemo(() => {
        if (periodMode === 'month') {
            return {
                start: startOfMonth(currentDate),
                end: endOfMonth(currentDate)
            };
        }

        const parsedStart = parseISO(customStart);
        const parsedEnd = parseISO(customEnd);
        const safeStart = isValid(parsedStart) ? startOfDay(parsedStart) : today;
        const safeEndRaw = isValid(parsedEnd) ? startOfDay(parsedEnd) : safeStart;
        const safeEnd = safeEndRaw.getTime() < safeStart.getTime() ? safeStart : safeEndRaw;

        return {
            start: safeStart,
            end: safeEnd
        };
    }, [periodMode, currentDate, customStart, customEnd, today]);

    const listVisibleStart = useMemo(() => {
        if (periodMode === 'custom') {
            return listQueryInterval.start;
        }

        const todayTs = today.getTime();
        const startTs = listQueryInterval.start.getTime();
        const endTs = listQueryInterval.end.getTime();
        const todayInsideRange = todayTs >= startTs && todayTs <= endTs;

        if (todayInsideRange) {
            return today;
        }

        return listQueryInterval.start;
    }, [periodMode, listQueryInterval, today]);

    const fetchRates = useCallback(async () => {
        if (!selectedRoomId) return;

        const queryStart = listQueryInterval.start;
        const queryEnd = listQueryInterval.end;

        setCalendarLoading(true);
        setCalendarError(null);
        try {
            const startKey = format(queryStart, 'yyyy-MM-dd');
            const endKey = format(queryEnd, 'yyyy-MM-dd');

            if (selectedRoomId === ALL_ROOMS_VALUE) {
                const targetRooms = roomTypes.length > 0 ? roomTypes : [];
                if (targetRooms.length === 0) {
                    setCalendarData([]);
                    setCalendarDataByRoom({});
                    return;
                }

                const roomPayloads = await Promise.all(
                    targetRooms.map(async (room) => {
                        const data = await fetchCalendarForRoom(room.id, startKey, endKey);
                        return { roomId: room.id, data };
                    })
                );

                const byRoom: Record<string, CalendarData[]> = {};
                roomPayloads.forEach((entry) => {
                    byRoom[entry.roomId] = entry.data;
                });

                setCalendarDataByRoom(byRoom);
                setCalendarData(byRoom[targetRooms[0].id] || []);
                return;
            }

            const data = await fetchCalendarForRoom(selectedRoomId, startKey, endKey);
            setCalendarData(data);
            setCalendarDataByRoom(prev => ({ ...prev, [selectedRoomId]: data }));
        } catch (error) {
            console.error('Error loading calendar data:', error);
            setCalendarData([]);
            setCalendarError(error instanceof Error ? error.message : 'Erro ao carregar calendário');
        } finally {
            setCalendarLoading(false);
        }
    }, [selectedRoomId, roomTypes, fetchCalendarForRoom, listQueryInterval]);

    useEffect(() => {
        if (selectedRoomId) {
            void fetchRates();
        }
    }, [selectedRoomId, fetchRates]);

    const getCalendarDataForRoom = useCallback((roomId: string) => {
        if (!roomId) return [];
        if (roomId === selectedRoomId && selectedRoomId !== ALL_ROOMS_VALUE) return calendarData;
        return calendarDataByRoom[roomId] || [];
    }, [calendarData, calendarDataByRoom, selectedRoomId]);

    const getDataForDay = (day: Date, roomId?: string) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const effectiveRoomId = roomId || selectedRoomId;
        const roomCalendar = getCalendarDataForRoom(effectiveRoomId);
        return roomCalendar.find(d => d.date === dateStr);
    };

    const getRateForDay = (day: Date, roomId?: string) => {
        // Kept for compatibility but should use getDataForDay
        const data = getDataForDay(day, roomId);
        if (!data) return undefined;
        return {
            id: data.rateId || 'temp',
            startDate: data.date,
            endDate: data.date,
            price: data.price,
            cta: data.cta,
            ctd: data.ctd,
            stopSell: data.stopSell,
            minLos: data.minLos
        };
    };

    // ... (rest of component)

    const [savingRate, setSavingRate] = useState<string | null>(null);

    const saveSingleDayRate = async (day: Date, updates: RateUpdatePayload, refreshAfter = true, roomTypeId?: string) => {
        const effectiveRoomId = roomTypeId || selectedRoomId;
        if (!effectiveRoomId || effectiveRoomId === ALL_ROOMS_VALUE) return;

        // Use bulk endpoint for single day update to ensure correct splitting
        const dateStr = format(day, 'yyyy-MM-dd');
        setSavingRate(`${effectiveRoomId}:${dateStr}`);
        try {
            const res = await fetch('/api/rates/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomTypeId: effectiveRoomId,
                    date: dateStr,
                    updates
                })
            });

            if (!res.ok) {
                const contentType = res.headers.get('content-type') || '';
                let message = 'Erro ao salvar alteração';
                if (contentType.includes('application/json')) {
                    const data = await res.json().catch(() => null);
                    if (data && typeof data === 'object') {
                        if (typeof (data as any).message === 'string') message = (data as any).message;
                        else if (typeof (data as any).error === 'string') message = (data as any).error;
                    }
                } else {
                    const text = await res.text().catch(() => '');
                    if (text) message = text;
                }
                throw new Error(message);
            }

            if (refreshAfter) await fetchRates();
        } catch (error) {
            console.error('Error saving single day rate:', error);
            showToast('error', error instanceof Error ? error.message : 'Erro ao salvar alteração');
            throw error;
        } finally {
            setSavingRate(null);
        }
    };

    const [updatingInventory, setUpdatingInventory] = useState<string | null>(null);
    const [updatingFourGuestInventory, setUpdatingFourGuestInventory] = useState<string | null>(null);

    const persistInventory = async (dateStr: string, newTotal: number, roomTypeId?: string) => {
        const effectiveRoomId = roomTypeId || selectedRoomId;
        if (!effectiveRoomId || effectiveRoomId === ALL_ROOMS_VALUE) return;
        setUpdatingInventory(`${effectiveRoomId}:${dateStr}`);
        try {
            const res = await fetch('/api/admin/inventory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomTypeId: effectiveRoomId,
                    date: dateStr,
                    totalUnits: newTotal
                })
            });
            if (!res.ok) throw new Error('Falha ao atualizar inventário');
            const data = await res.json().catch(() => null);
            if (data && typeof data === 'object' && (data as any).appliedLimit) {
                showToast('info', `Ajuste limitado por reservas em ${dateStr}.`);
            }
        } finally {
            setUpdatingInventory(null);
        }
    };

    const persistFourGuestInventory = async (dateStr: string, newTotal: number, roomTypeId?: string) => {
        const effectiveRoomId = roomTypeId || selectedRoomId;
        if (!effectiveRoomId || effectiveRoomId === ALL_ROOMS_VALUE) return;
        setUpdatingFourGuestInventory(`${effectiveRoomId}:${dateStr}`);
        try {
            const res = await fetch('/api/admin/inventory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomTypeId: effectiveRoomId,
                    date: dateStr,
                    totalUnits: newTotal,
                    inventoryType: 'fourGuests'
                })
            });
            if (!res.ok) throw new Error('Falha ao atualizar disponibilidade do quadruplo');
            const data = await res.json().catch(() => null);
            if (data && typeof data === 'object' && (data as any).appliedLimit) {
                showToast('info', `Ajuste do quadruplo limitado por reservas em ${dateStr}.`);
            }
        } finally {
            setUpdatingFourGuestInventory(null);
        }
    };

    // --- Grid View Logic ---

    const handleDateClick = (day: Date) => {
        const data = getDataForDay(day);
        const rate = getRateForDay(day);
        setSelectedDate(day);
        
        if (data) {
            setEditPrice(String(data.price));
            setEditMinLos(String(data.minLos));
            setEditStopSell(Boolean(data.stopSell));
            setEditCta(Boolean(data.cta));
            setEditCtd(Boolean(data.ctd));
            setEditInventory(String(data.totalInventory ?? data.capacityTotal ?? 0));
            setExistingRateId(rate?.id ?? null);
        } else {
            const room = roomTypes.find(r => r.id === selectedRoomId);
            setEditPrice(room?.basePrice.toString() || '0');
            setEditMinLos('1');
            setEditStopSell(false);
            setEditCta(false);
            setEditCtd(false);
            setEditInventory('1');
            setExistingRateId(null);
        }
        
        setModalOpen(true);
    };

    const handleSave = async () => {
        if (!selectedRoomId || !selectedDate || !editPrice) return;

        const price = parseFloat(editPrice);
        if (isNaN(price)) {
            showToast('error', 'Preço inválido');
            return;
        }

        const inventoryValue = Number(editInventory);
        if (!Number.isFinite(inventoryValue) || inventoryValue < 0) {
            showToast('error', 'Quantidade de quartos inválida.');
            return;
        }

        const dateStr = format(selectedDate, 'yyyy-MM-dd');

        try {
            await saveSingleDayRate(selectedDate, {
                price,
                minLos: parseInt(editMinLos) || 1,
                stopSell: editStopSell,
                cta: editCta,
                ctd: editCtd
            }, false);

            await persistInventory(dateStr, Math.floor(inventoryValue));
            await fetchRates();

            setModalOpen(false);
            showToast('success', 'Alteração aplicada com sucesso.');
        } catch {
            return;
        }
    };
    const handleDelete = async () => {
        if (!existingRateId || !selectedDate) return;
        
        if (!confirm('Tem certeza que deseja remover esta tarifa personalizada? O preço voltará ao valor base.')) return;

        // To "delete" a customization for a specific day that might be part of a range,
        // we essentially want to reset it to base price (or delete the record if it's 1-day).
        // However, "delete" in this context usually means "remove overrides".
        // The bulk endpoint logic merges with defaults if not provided. 
        // But we want to explicitly remove the rate record for this day.
        
        // Strategy: We can use the bulk endpoint to "reset" the day. 
        // But wait, if we want to DELETE the rate record so it falls back to RoomType default,
        // we need a way to say "clear rate".
        // Current bulk logic creates rates. 
        
        // Alternative: If the user wants to DELETE, we should find the rate covering this day.
        // If it covers ONLY this day, delete it.
        // If it covers multiple days, we need to SPLIT it and remove the middle.
        
        // Let's implement a specific logic here or improve bulk to handle "delete" action?
        // Simpler: Just use the existing DELETE endpoint if it's a 1-day rate?
        // No, that doesn't solve the "part of range" issue.
        
        // Let's manually implement the split-and-delete logic here or via a new endpoint?
        // Actually, let's keep it simple: If they click delete, we try to delete the rate.
        // If it affects other days, we should warn? Or just split?
        // "Delete" usually implies "Reset to Default". 
        // If I have a rate for Jan 1-10 of $500.
        // And I delete Jan 5.
        // I expect Jan 1-4 and Jan 6-10 to stay $500, and Jan 5 to become Base Price (no rate record).
        
        try {
            // We can reuse the bulk endpoint logic concept but we need a "delete" mode.
            // For now, let's just stick to the old DELETE method but warn the user if it spans multiple days?
            // Or better: Let's assume the user wants to RESET the price to base.
            // We can't easily "delete" a hole in a rate range with current API.
            // Let's just fallback to "Set to Base Price" using saveSingleDayRate?
            // But that creates a rate record with the base price, which is visually similar but technically different (it overrides future base price changes).
            
            // Correct approach: Split the rate on backend and delete the target segment.
            // Since we don't have that endpoint ready, let's stick to the simple DELETE for now, 
            // but beware it deletes the whole range.
            // To fix "it edits in batch" for DELETE, we would need backend changes.
            // But the user specifically asked about "editing".
            
            await fetch(`/api/rates/${existingRateId}`, {
                method: 'DELETE'
            });
            setModalOpen(false);
            fetchRates();
        } catch (error) {
            console.error('Error deleting rate:', error);
            showToast('error', 'Erro ao excluir tarifa');
        }
    };

    // --- List View Logic ---

    const updateRateField = async (
        day: Date,
        field: 'price' | 'minLos' | 'stopSell' | 'cta' | 'ctd' | 'inventory' | 'fourGuestInventory',
        value: string | number | boolean,
        roomTypeId?: string
    ) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const effectiveRoomId = roomTypeId || selectedRoomId;
        if (!effectiveRoomId || effectiveRoomId === ALL_ROOMS_VALUE) return;

        try {
            if (field === 'inventory') {
                const inv = Number(value);
                if (Number.isNaN(inv) || inv < 0) return;
                await persistInventory(dateStr, inv, effectiveRoomId);
                await fetchRates();
                showToast('success', `Inventário atualizado para ${dateStr}.`);
                return;
            }
            if (field === 'fourGuestInventory') {
                const inv = Number(value);
                if (Number.isNaN(inv) || inv < 0) return;
                await persistFourGuestInventory(dateStr, inv, effectiveRoomId);
                await fetchRates();
                showToast('success', `Disponibilidade do quadruplo atualizada em ${dateStr}.`);
                return;
            }
            await saveSingleDayRate(day, { [field]: value }, true, effectiveRoomId);
            showToast('success', `Alteração aplicada em ${dateStr}.`);
        } catch (error) {
            console.error('Error updating field:', error);
            showToast('error', error instanceof Error ? error.message : 'Erro ao atualizar campo.');
        }
    };

    const handleBulkSave = async () => {
        if (!bulkStart || !bulkEnd) {
            showToast('error', 'Preencha as datas.');
            return;
        }

        if (bulkEnd < bulkStart) {
            showToast('error', 'A data final não pode ser menor que a inicial.');
            return;
        }

        const { updates, errors } = buildBulkUpdates(bulkFieldToggles, bulkFieldValues);
        if (errors.length > 0) {
            showToast('error', errors[0]);
            return;
        }
        if (Object.keys(updates).length === 0) {
            showToast('error', 'Ative pelo menos um campo para atualizar.');
            return;
        }

        if (bulkSelectedDays.length === 0) {
            showToast('error', 'Selecione ao menos um dia da semana.');
            return;
        }

        try {
            const rateUpdates = { ...updates };
            delete rateUpdates.inventory;
            const requests: Promise<Response>[] = [];

            if (Object.keys(rateUpdates).length > 0) {
                const payload = {
                    roomTypeId: bulkRoomTypeId,
                    startDate: bulkStart,
                    endDate: bulkEnd,
                    updates: rateUpdates,
                    daysOfWeek: bulkSelectedDays
                };
                console.log('[Frontend] Bulk Rate Payload:', JSON.stringify(payload, null, 2));

                requests.push(fetch('/api/rates/bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }));
            }

            if (updates.inventory !== undefined) {
                const inventoryPayload = {
                    roomTypeId: bulkRoomTypeId,
                    startDate: bulkStart,
                    endDate: bulkEnd,
                    updates: bulkInventoryTarget === 'fourGuests'
                        ? { fourGuestInventory: updates.inventory }
                        : { inventory: updates.inventory },
                    inventoryType: bulkInventoryTarget,
                    daysOfWeek: bulkSelectedDays
                };
                console.log('[Frontend] Bulk Inventory Payload:', JSON.stringify(inventoryPayload, null, 2));

                requests.push(fetch('/api/admin/inventory', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(inventoryPayload)
                }));
            }

            const responses = await Promise.all(requests);
            for (const res of responses) {
                if (res.ok) continue;

                const contentType = res.headers.get('content-type') || '';
                let message = 'Erro ao atualizar em lote.';
                if (contentType.includes('application/json')) {
                    const data = await res.json().catch(() => null);
                    if (data && typeof data === 'object') {
                        if (typeof (data as any).message === 'string') message = (data as any).message;
                        else if (typeof (data as any).error === 'string') message = (data as any).error;
                    }
                } else {
                    const text = await res.text().catch(() => '');
                    if (text) message = text;
                }
                throw new Error(message);
            }

            setBulkModalOpen(false);
            fetchRates();
            showToast('success', 'Atualização em lote concluída!');
            
        } catch (error) {
            console.error('Error bulk updating:', error);
            showToast('error', error instanceof Error ? error.message : 'Erro ao atualizar em lote.');
        }
    };

    const clearBulkFields = () => {
        setBulkRoomTypeId('all');
        setBulkStart('');
        setBulkEnd('');
        setBulkFieldValues(defaultBulkFieldValues());
        setBulkFieldToggles(defaultBulkFieldToggles());
        setBulkInventoryTarget('standard');
        resetBulkWeekdays();
    };


    const days = eachDayOfInterval({
        start: startOfWeek(startOfMonth(currentDate)),
        end: endOfWeek(endOfMonth(currentDate))
    });

    const monthDays = eachDayOfInterval({
        start: listVisibleStart,
        end: listQueryInterval.end
    });
    const monthDayKeys = useMemo(() => monthDays.map(day => format(day, 'yyyy-MM-dd')), [monthDays]);
    const todayKey = format(today, 'yyyy-MM-dd');
    const todayLabel = format(today, 'dd/MM/yyyy');
    const listStartLabel = format(listVisibleStart, 'dd/MM/yyyy');
    const listEndLabel = format(listQueryInterval.end, 'dd/MM/yyyy');
    const listQueryStartLabel = format(listQueryInterval.start, 'dd/MM/yyyy');
    const selectedDayData = selectedDate ? getDataForDay(selectedDate) : undefined;
    const selectedDayOccupancy = getOccupancyMetrics(selectedDayData);
    const selectedDateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
    const modalSaving = selectedDateKey
        ? savingRate === `${selectedRoomId}:${selectedDateKey}` || updatingInventory === `${selectedRoomId}:${selectedDateKey}`
        : false;

    useEffect(() => {
        hasAutoCenteredTodayRef.current = false;
    }, [periodMode, currentDate, customStart, customEnd]);

    useEffect(() => {
        if (periodMode !== 'month' || calendarLoading) return;
        if (hasAutoCenteredTodayRef.current) return;
        const wrapper = listScrollRef.current;
        if (!wrapper) return;

        const target = wrapper.querySelector(`[data-date="${todayKey}"]`) as HTMLElement | null;
        if (!target) return;

        const left = Math.max(0, target.offsetLeft - (wrapper.clientWidth / 2) + (target.clientWidth / 2));
        wrapper.scrollTo({ left, behavior: 'smooth' });
        hasAutoCenteredTodayRef.current = true;
    }, [periodMode, calendarLoading, todayKey]);

    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const listRoomTypes = useMemo(() => (
        selectedRoomId === ALL_ROOMS_VALUE
            ? roomTypes
            : roomTypes.filter(room => room.id === selectedRoomId)
    ), [selectedRoomId, roomTypes]);
    const bulkAffectedDaysCount = useMemo(
        () => countAffectedDays(bulkStart, bulkEnd, bulkWeekdays),
        [bulkStart, bulkEnd, bulkWeekdays]
    );
    const bulkSelectedDays = useMemo(() => getSelectedWeekdays(bulkWeekdays), [bulkWeekdays]);
    const bulkHasActiveFields = useMemo(() => hasActiveBulkChanges(bulkFieldToggles), [bulkFieldToggles]);
    const bulkScopeLabel = useMemo(() => {
        if (bulkRoomTypeId === 'all') return 'Todos os tipos de quarto';
        return roomTypes.find(room => room.id === bulkRoomTypeId)?.name || 'Tipo de quarto selecionado';
    }, [bulkRoomTypeId, roomTypes]);
    const selectedInventoryDates = useMemo(() => {
        if (!inventorySelection) return [];
        return inventorySelection.dates;
    }, [inventorySelection]);

    const toggleRoomCollapsed = (roomId: string) => {
        setCollapsedRooms(prev => ({ ...prev, [roomId]: !prev[roomId] }));
    };

    const getOccupancyBandClass = (band: OccupancyBand | null) => {
        if (band === 'low') return styles.occupancyLow;
        if (band === 'medium') return styles.occupancyMedium;
        if (band === 'high') return styles.occupancyHigh;
        if (band === 'veryHigh') return styles.occupancyVeryHigh;
        return '';
    };

    const stopListDragging = useCallback(() => {
        if (!listDragStateRef.current.isDragging) return;
        listDragStateRef.current.isDragging = false;
        setIsListDragging(false);
    }, []);

    const handleListMouseDown = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        const target = event.target as HTMLElement | null;
        if (target?.closest('input, button, select, textarea, label, a')) return;

        const wrapper = listScrollRef.current;
        if (!wrapper) return;

        listDragStateRef.current = {
            isDragging: true,
            startX: event.clientX,
            startScrollLeft: wrapper.scrollLeft
        };
        setIsListDragging(true);
    }, []);

    const handleListMouseMove = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
        if (!listDragStateRef.current.isDragging) return;
        const wrapper = listScrollRef.current;
        if (!wrapper) return;

        event.preventDefault();
        const delta = event.clientX - listDragStateRef.current.startX;
        wrapper.scrollLeft = listDragStateRef.current.startScrollLeft - delta;
    }, []);

    useEffect(() => {
        const onWindowMouseUp = () => stopListDragging();
        window.addEventListener('mouseup', onWindowMouseUp);
        window.addEventListener('blur', onWindowMouseUp);

        return () => {
            window.removeEventListener('mouseup', onWindowMouseUp);
            window.removeEventListener('blur', onWindowMouseUp);
        };
    }, [stopListDragging]);

    const clearInventorySelection = useCallback(() => {
        setInventoryDragState(null);
        setInventorySelection(null);
        setInventoryBatchValue('');
        setInventoryBatchSaving(false);
    }, []);

    const beginInventoryDrag = useCallback((
        event: ReactMouseEvent<HTMLTableCellElement>,
        roomId: string,
        field: DragSelectionField,
        dateKey: string
    ) => {
        if (event.button !== 0) return;
        const target = event.target as HTMLElement | null;
        if (target?.closest('[data-no-drag="true"]')) return;
        event.stopPropagation();

        if (!(field === 'price' || field === 'minLos')) {
            event.preventDefault();
        }

        const rect = event.currentTarget.getBoundingClientRect();
        setInventoryBatchValue('');
        setInventorySelection(null);
        setInventoryDragState({
            roomId,
            field,
            startDate: dateKey,
            currentDate: dateKey,
            moved: false,
            anchorRect: {
                left: rect.left,
                top: rect.top,
                bottom: rect.bottom,
            },
        });
    }, []);

    const extendInventoryDrag = useCallback((
        event: ReactMouseEvent<HTMLTableCellElement>,
        roomId: string,
        field: DragSelectionField,
        dateKey: string
    ) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setInventoryDragState((prev) => {
            if (!prev) return prev;
            if (prev.roomId !== roomId || prev.field !== field) return prev;
            if (prev.currentDate === dateKey) return prev;
            return {
                ...prev,
                currentDate: dateKey,
                moved: true,
                anchorRect: {
                    left: rect.left,
                    top: rect.top,
                    bottom: rect.bottom,
                },
            };
        });
    }, []);

    const applyInventorySelectionValue = useCallback(async () => {
        if (!inventorySelection) return;

        const room = roomTypes.find((entry) => entry.id === inventorySelection.roomId);
        if (!room) {
            showToast('error', 'Quarto não encontrado para aplicar a seleção.');
            return;
        }

        let rateUpdates: RateUpdatePayload | null = null;
        let inventoryPayload:
            | {
                roomTypeId: string;
                startDate: string;
                endDate: string;
                updates: { inventory: number } | { fourGuestInventory: number };
                inventoryType: 'standard' | 'fourGuests';
            }
            | null = null;

        if (isInventorySelectionField(inventorySelection.field)) {
            const inventoryField = inventorySelection.field;
            const requestedValue = Number.parseInt(inventoryBatchValue, 10);
            if (!Number.isFinite(requestedValue)) {
                showToast('error', 'Informe um valor numérico válido para aplicar.');
                return;
            }

            const invalidDate = inventorySelection.dates.find((dateKey) => {
                const dayDate = parseISO(`${dateKey}T00:00:00`);
                const data = getDataForDay(dayDate, inventorySelection.roomId);
                const maxAllowed = getInventoryMaxAllowed({
                    field: inventoryField,
                    capacityTotal: data?.capacityTotal,
                    bookingsCount: data?.bookingsCount,
                    fourGuestCapacityTotal: data?.fourGuestCapacityTotal,
                    bookingsFor4GuestsCount: data?.bookingsFor4GuestsCount,
                });

                return requestedValue < 0 || requestedValue > maxAllowed;
            });

            if (invalidDate) {
                const data = getDataForDay(parseISO(`${invalidDate}T00:00:00`), inventorySelection.roomId);
                const maxAllowed = getInventoryMaxAllowed({
                    field: inventoryField,
                    capacityTotal: data?.capacityTotal,
                    bookingsCount: data?.bookingsCount,
                    fourGuestCapacityTotal: data?.fourGuestCapacityTotal,
                    bookingsFor4GuestsCount: data?.bookingsFor4GuestsCount,
                });
                showToast('error', `Não foi possível aplicar ${requestedValue} em ${invalidDate}. Limite permitido para essa data: ${maxAllowed}.`);
                return;
            }

            const sortedDates = [...inventorySelection.dates].sort();
            inventoryPayload = {
                roomTypeId: room.id,
                startDate: sortedDates[0],
                endDate: sortedDates[sortedDates.length - 1],
                updates: inventoryField === 'fourGuestInventory'
                    ? { fourGuestInventory: requestedValue }
                    : { inventory: requestedValue },
                inventoryType: inventoryField === 'fourGuestInventory' ? 'fourGuests' : 'standard',
            };
        } else if (inventorySelection.field === 'price') {
            const requestedValue = Number.parseFloat(inventoryBatchValue);
            if (!Number.isFinite(requestedValue)) {
                showToast('error', 'Informe um preço válido para aplicar.');
                return;
            }
            rateUpdates = { price: requestedValue };
        } else if (inventorySelection.field === 'minLos') {
            const requestedValue = Number.parseInt(inventoryBatchValue, 10);
            if (!Number.isFinite(requestedValue) || requestedValue < 1) {
                showToast('error', 'Informe um mínimo de noites válido para aplicar.');
                return;
            }
            rateUpdates = { minLos: requestedValue };
        } else if (inventorySelection.field === 'cta' || inventorySelection.field === 'ctd') {
            if (inventoryBatchValue !== 'true' && inventoryBatchValue !== 'false') {
                showToast('error', `Selecione um valor válido para ${inventorySelection.field.toUpperCase()}.`);
                return;
            }
            rateUpdates = { [inventorySelection.field]: inventoryBatchValue === 'true' };
        }

        const sortedDates = [...inventorySelection.dates].sort();
        const selectedWeekdays = Array.from(new Set(
            sortedDates.map((dateKey) => parseISO(`${dateKey}T00:00:00`).getDay())
        )).sort((a, b) => a - b);

        setInventoryBatchSaving(true);
        try {
            const res = await fetch(
                inventoryPayload ? '/api/admin/inventory' : '/api/rates/bulk',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(
                        inventoryPayload ?? {
                            roomTypeId: room.id,
                            startDate: sortedDates[0],
                            endDate: sortedDates[sortedDates.length - 1],
                            updates: rateUpdates,
                            daysOfWeek: selectedWeekdays,
                        }
                    )
                }
            );

            if (!res.ok) {
                throw new Error(
                    isInventorySelectionField(inventorySelection.field)
                        ? 'Falha ao aplicar inventário em lote.'
                        : 'Falha ao aplicar atualização em lote.'
                );
            }

            const data = await res.json().catch(() => null);
            if (inventoryPayload && data && typeof data === 'object' && (data as any).appliedLimit) {
                showToast('error', 'A aplicação em lote foi limitada por reservas existentes. Revise as datas selecionadas.');
                await fetchRates();
                clearInventorySelection();
                return;
            }

            await fetchRates();
            showToast(
                'success',
                `${isInventorySelectionField(inventorySelection.field) ? 'Inventário' : 'Alteração'} aplicado em ${sortedDates.length} ${sortedDates.length === 1 ? 'dia' : 'dias'}.`
            );
            clearInventorySelection();
        } catch (error) {
            console.error('Error applying inventory selection:', error);
            showToast(
                'error',
                error instanceof Error
                    ? error.message
                    : isInventorySelectionField(inventorySelection.field)
                        ? 'Erro ao aplicar inventário em lote.'
                        : 'Erro ao aplicar atualização em lote.'
            );
        } finally {
            setInventoryBatchSaving(false);
        }
    }, [clearInventorySelection, fetchRates, getDataForDay, inventoryBatchValue, inventorySelection, roomTypes, showToast]);

    useEffect(() => {
        if (!inventoryDragState) return;

        const finalizeSelection = () => {
            setInventoryDragState((current) => {
                if (!current) return current;
                if (!current.moved) return null;

                const dates = getHorizontalSelection(monthDayKeys, current.startDate, current.currentDate);
                if (dates.length <= 1) return null;

                setInventorySelection({
                    roomId: current.roomId,
                    field: current.field,
                    dates,
                    anchorRect: current.anchorRect,
                });
                return null;
            });
        };

        window.addEventListener('mouseup', finalizeSelection);
        window.addEventListener('blur', finalizeSelection);
        return () => {
            window.removeEventListener('mouseup', finalizeSelection);
            window.removeEventListener('blur', finalizeSelection);
        };
    }, [inventoryDragState, monthDayKeys]);

    useEffect(() => {
        if (!inventorySelection) return;

        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest('[data-inventory-batch-popover="true"]')) return;
            if (target?.closest('[data-inventory-selection-cell="true"]')) return;
            clearInventorySelection();
        };

        window.addEventListener('mousedown', handlePointerDown);
        return () => window.removeEventListener('mousedown', handlePointerDown);
    }, [clearInventorySelection, inventorySelection]);

    const renderListRowsForRoom = (room: RoomType) => (
        <Fragment key={room.id}>
            <tr>
                <td className={styles.stickyCol} style={{ background: '#eef2ff', fontWeight: 800 }}>
                    <button
                        type="button"
                        onClick={() => toggleRoomCollapsed(room.id)}
                        aria-label={collapsedRooms[room.id] ? `Expandir ${room.name}` : `Recolher ${room.name}`}
                        style={{
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            color: '#1e3a8a',
                            fontWeight: 800,
                            fontSize: '1rem',
                            marginRight: '0.5rem',
                            width: '1.1rem',
                            textAlign: 'center'
                        }}
                    >
                        {collapsedRooms[room.id] ? '>' : 'v'}
                    </button>
                    <span>🏨 {room.name}</span>
                </td>
                <td colSpan={monthDays.length} style={{ textAlign: 'left', paddingLeft: '1rem', background: '#f8fafc', color: '#475569', fontWeight: 600 }}>
                    <span>Visualização diária de disponibilidade, ocupação e restrições.</span>
                </td>
            </tr>

            {!collapsedRooms[room.id] && (
                <>
            <tr>
                <td className={styles.stickyCol}>Status</td>
                {monthDays.map(day => {
                    const data = getDataForDay(day, room.id);
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const isTodayCol = dateStr === todayKey;
                    const isClosed = data?.stopSell;
                    const isZero = (data?.available ?? 1) <= 0;
                    return (
                        <td
                            key={`${room.id}-status-${dateStr}`}
                            className={`${styles.cell} ${isTodayCol ? styles.todayColumnCell : ''}`}
                            onClick={() => updateRateField(day, 'stopSell', !isClosed, room.id)}
                        >
                            <div className={`${styles.statusPill} ${(isClosed || isZero) ? styles.closed : styles.open}`}>
                                {isClosed ? 'FECHADO' : (isZero ? 'ESGOTADO' : 'ABERTO')}
                            </div>
                        </td>
                    );
                })}
            </tr>

            <tr>
                <td className={styles.stickyCol}>Ocupação</td>
                {monthDays.map(day => {
                    const data = getDataForDay(day, room.id);
                    const bookingsCount = data?.bookingsCount ?? 0;
                    const capacityTotal = data?.capacityTotal ?? 0;
                    const isClosed = data?.stopSell ?? false;
                    const occupancy = getOccupancyMetrics(data);
                    const occupancyBandClass = getOccupancyBandClass(occupancy.band);
                    const occupancyLabel = occupancy.band ? OCCUPANCY_BAND_LABEL[occupancy.band] : null;
                    const occupancyPctLabel = occupancy.occupancyPct === null ? '—' : `${Math.round(occupancy.occupancyPct)}%`;
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const isTodayCol = dateStr === todayKey;
                    return (
                        <td key={`${room.id}-occupancy-${dateStr}`} className={`${styles.cell} ${isTodayCol ? styles.todayColumnCell : ''}`}>
                            <div className={`${styles.occupancySummaryCard} ${isClosed ? styles.inventoryClosed : occupancyBandClass}`}>
                                <span className={styles.occupancyMeta}>
                                    Reservados: {bookingsCount} | Capacidade física: {capacityTotal}
                                </span>
                                <span className={`${styles.occupancyRow} ${isClosed ? styles.occupancyRowClosed : ''}`}>
                                    Ocupação: <strong>{occupancyPctLabel}</strong>
                                    {occupancyLabel && (
                                        <span className={`${styles.occupancyBadge} ${isClosed ? styles.occupancyBadgeClosed : occupancyBandClass}`}>
                                            {occupancyLabel}
                                        </span>
                                    )}
                                </span>
                            </div>
                        </td>
                    );
                })}
            </tr>

            <tr>
                <td className={styles.stickyCol}>Standard</td>
                {monthDays.map(day => {
                    const data = getDataForDay(day, room.id);
                    const available = data?.available ?? 0;
                    const isClosed = data?.stopSell ?? false;
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const inventoryKey = `${room.id}:${dateStr}`;
                    const isTodayCol = dateStr === todayKey;
                    const maxAllowed = getInventoryMaxAllowed({
                        field: 'inventory',
                        capacityTotal: data?.capacityTotal,
                        bookingsCount: data?.bookingsCount,
                    });
                    const isSelected = inventorySelection?.roomId === room.id
                        && inventorySelection.field === 'inventory'
                        && selectedInventoryDates.includes(dateStr);
                    return (
                        <td
                            key={`${room.id}-inventory-${dateStr}`}
                            className={`${styles.cell} ${isTodayCol ? styles.todayColumnCell : ''} ${isSelected ? styles.inventorySelectionCell : ''}`}
                            onMouseDown={(event) => beginInventoryDrag(event, room.id, 'inventory', dateStr)}
                            onMouseEnter={(event) => extendInventoryDrag(event, room.id, 'inventory', dateStr)}
                            data-inventory-selection-cell="true"
                            data-testid={`inventory-cell-${room.id}-${dateStr}`}
                        >
                            <InventoryStepper
                                className={`${styles.inventoryStepper} ${isClosed || available <= 0 ? styles.inventoryStepperBlocked : styles.inventoryStepperAvailable}`}
                                value={available}
                                displayValue={updatingInventory === inventoryKey ? '...' : String(available)}
                                isLoading={updatingInventory === inventoryKey}
                                maxValue={maxAllowed}
                                decrementDisabled={available <= 0}
                                incrementDisabled={available >= maxAllowed}
                                decrementLabel={`Diminuir standard de ${room.name} em ${dateStr}`}
                                incrementLabel={`Aumentar standard de ${room.name} em ${dateStr}`}
                                onDecrement={() => updateRateField(day, 'inventory', Math.max(0, available - 1), room.id)}
                                onIncrement={() => updateRateField(day, 'inventory', Math.min(maxAllowed, available + 1), room.id)}
                                onCommit={(nextValue) => updateRateField(day, 'inventory', nextValue, room.id)}
                                onInvalid={(message) => showToast('error', `${message} (${dateStr})`)}
                            />
                        </td>
                    );
                })}
            </tr>

            <tr>
                <td className={styles.stickyCol}>Quadruplo</td>
                {monthDays.map(day => {
                    const data = getDataForDay(day, room.id);
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const isTodayCol = dateStr === todayKey;
                    const maxInventory = Math.max(0, Number(room.inventoryFor4Guests ?? data?.fourGuestCapacityTotal ?? 0));
                    const fourGuestInventory = Math.max(0, Math.min(maxInventory, Number(data?.fourGuestInventory ?? maxInventory)));
                    const bookingsFor4GuestsCount = Math.max(0, Number(data?.bookingsFor4GuestsCount ?? 0));
                    const isUpdating = updatingFourGuestInventory === `${room.id}:${dateStr}`;
                    const canDecrease = !isUpdating && maxInventory > 0 && fourGuestInventory > 0;
                    const canIncrease = !isUpdating && maxInventory > 0 && fourGuestInventory < maxInventory;
                    const maxAllowed = getInventoryMaxAllowed({
                        field: 'fourGuestInventory',
                        fourGuestCapacityTotal: data?.fourGuestCapacityTotal ?? maxInventory,
                        bookingsFor4GuestsCount,
                    });
                    const isSelected = inventorySelection?.roomId === room.id
                        && inventorySelection.field === 'fourGuestInventory'
                        && selectedInventoryDates.includes(dateStr);

                    return (
                        <td
                            key={`${room.id}-four-guest-${dateStr}`}
                            className={`${styles.cell} ${isTodayCol ? styles.todayColumnCell : ''} ${isSelected ? styles.inventorySelectionCell : ''}`}
                            onMouseDown={(event) => beginInventoryDrag(event, room.id, 'fourGuestInventory', dateStr)}
                            onMouseEnter={(event) => extendInventoryDrag(event, room.id, 'fourGuestInventory', dateStr)}
                            data-inventory-selection-cell="true"
                            data-testid={`four-guest-cell-${room.id}-${dateStr}`}
                        >
                            <InventoryStepper
                                className={`${styles.fourGuestStepper} ${maxInventory <= 0 ? styles.fourGuestStepperDisabled : fourGuestInventory <= 0 ? styles.fourGuestStepperBlocked : styles.fourGuestStepperAvailable}`}
                                displayValue={isUpdating ? '...' : maxInventory <= 0 ? 'N/A' : String(fourGuestInventory)}
                                value={maxInventory <= 0 ? 0 : fourGuestInventory}
                                isLoading={isUpdating}
                                editingDisabled={maxInventory <= 0}
                                maxValue={maxAllowed}
                                decrementDisabled={!canDecrease}
                                incrementDisabled={!canIncrease}
                                decrementLabel={`Diminuir quadruplo de ${room.name} em ${dateStr}`}
                                incrementLabel={`Aumentar quadruplo de ${room.name} em ${dateStr}`}
                                onDecrement={() => updateRateField(day, 'fourGuestInventory', Math.max(0, fourGuestInventory - 1), room.id)}
                                onIncrement={() => updateRateField(day, 'fourGuestInventory', Math.min(maxAllowed, fourGuestInventory + 1), room.id)}
                                onCommit={(nextValue) => updateRateField(day, 'fourGuestInventory', nextValue, room.id)}
                                onInvalid={(message) => showToast('error', `${message} (${dateStr})`)}
                            />
                        </td>
                    );
                })}
            </tr>

            <tr>
                <td className={styles.stickyCol}>Preço (R$)</td>
                {monthDays.map(day => {
                    const data = getDataForDay(day, room.id);
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const price = data ? data.price : Number(room.basePrice || 0);
                    const isTodayCol = dateStr === todayKey;
                    const isSelected = inventorySelection?.roomId === room.id
                        && inventorySelection.field === 'price'
                        && selectedInventoryDates.includes(dateStr);
                    return (
                        <td
                            key={`${room.id}-price-${dateStr}`}
                            className={`${styles.cell} ${isTodayCol ? styles.todayColumnCell : ''} ${isSelected ? styles.inventorySelectionCell : ''}`}
                            onMouseDown={(event) => beginInventoryDrag(event, room.id, 'price', dateStr)}
                            onMouseEnter={(event) => extendInventoryDrag(event, room.id, 'price', dateStr)}
                            data-inventory-selection-cell="true"
                            data-testid={`price-cell-${room.id}-${dateStr}`}
                        >
                            <EditableCell
                                type="number"
                                value={price}
                                onSave={(val) => updateRateField(day, 'price', val, room.id)}
                            />
                        </td>
                    );
                })}
            </tr>

            <tr>
                <td className={styles.stickyCol}>Min. Noites</td>
                {monthDays.map(day => {
                    const data = getDataForDay(day, room.id);
                    const minLos = data ? data.minLos : 1;
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const isTodayCol = dateStr === todayKey;
                    const isSelected = inventorySelection?.roomId === room.id
                        && inventorySelection.field === 'minLos'
                        && selectedInventoryDates.includes(dateStr);
                    return (
                        <td
                            key={`${room.id}-minlos-${dateStr}`}
                            className={`${styles.cell} ${isTodayCol ? styles.todayColumnCell : ''} ${isSelected ? styles.inventorySelectionCell : ''}`}
                            onMouseDown={(event) => beginInventoryDrag(event, room.id, 'minLos', dateStr)}
                            onMouseEnter={(event) => extendInventoryDrag(event, room.id, 'minLos', dateStr)}
                            data-inventory-selection-cell="true"
                            data-testid={`minlos-cell-${room.id}-${dateStr}`}
                        >
                            <EditableCell
                                type="number"
                                min="1"
                                value={minLos}
                                onSave={(val) => updateRateField(day, 'minLos', val, room.id)}
                            />
                        </td>
                    );
                })}
            </tr>

            <tr>
                <td className={styles.stickyCol}>Entrada (CTA)</td>
                {monthDays.map(day => {
                    const data = getDataForDay(day, room.id);
                    const cta = data?.cta;
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const isTodayCol = dateStr === todayKey;
                    const isSelected = inventorySelection?.roomId === room.id
                        && inventorySelection.field === 'cta'
                        && selectedInventoryDates.includes(dateStr);
                    return (
                        <td
                            key={`${room.id}-cta-${dateStr}`}
                            className={`${styles.cell} ${isTodayCol ? styles.todayColumnCell : ''} ${isSelected ? styles.inventorySelectionCell : ''}`}
                            onMouseDown={(event) => beginInventoryDrag(event, room.id, 'cta', dateStr)}
                            onMouseEnter={(event) => extendInventoryDrag(event, room.id, 'cta', dateStr)}
                            onClick={() => updateRateField(day, 'cta', !cta, room.id)}
                            data-inventory-selection-cell="true"
                            data-testid={`cta-cell-${room.id}-${dateStr}`}
                        >
                            <div className={`${styles.restrictionCell} ${cta ? styles.restrictionActive : styles.restrictionInactive}`}>
                                {cta ? (
                                    <span className={`${styles.restrictionBadge} ${styles.restrictionClosedIn}`}>
                                        FECHADO PARA ENTRADA
                                    </span>
                                ) : (
                                    <span className={styles.restrictionPlaceholder}>—</span>
                                )}
                            </div>
                        </td>
                    );
                })}
            </tr>

            <tr>
                <td className={styles.stickyCol}>Saída (CTD)</td>
                {monthDays.map(day => {
                    const data = getDataForDay(day, room.id);
                    const ctd = data?.ctd;
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const isTodayCol = dateStr === todayKey;
                    const isSelected = inventorySelection?.roomId === room.id
                        && inventorySelection.field === 'ctd'
                        && selectedInventoryDates.includes(dateStr);
                    return (
                        <td
                            key={`${room.id}-ctd-${dateStr}`}
                            className={`${styles.cell} ${isTodayCol ? styles.todayColumnCell : ''} ${isSelected ? styles.inventorySelectionCell : ''}`}
                            onMouseDown={(event) => beginInventoryDrag(event, room.id, 'ctd', dateStr)}
                            onMouseEnter={(event) => extendInventoryDrag(event, room.id, 'ctd', dateStr)}
                            onClick={() => updateRateField(day, 'ctd', !ctd, room.id)}
                            data-inventory-selection-cell="true"
                            data-testid={`ctd-cell-${room.id}-${dateStr}`}
                        >
                            <div className={`${styles.restrictionCell} ${ctd ? styles.restrictionActive : styles.restrictionInactive}`}>
                                {ctd ? (
                                    <span className={`${styles.restrictionBadge} ${styles.restrictionClosedOut}`}>
                                        FECHADO PARA SAÍDA
                                    </span>
                                ) : (
                                    <span className={styles.restrictionPlaceholder}>—</span>
                                )}
                            </div>
                        </td>
                    );
                })}
            </tr>
                </>
            )}
        </Fragment>
    );

    return (
        <>
            <div className={styles.header}>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Mapa de Tarifas</h1>
                <Link href="/admin/dashboard" style={{ color: '#3b82f6', textDecoration: 'underline' }}>
                    Voltar ao Dashboard
                </Link>
            </div>

            <div className={styles.controls}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'nowrap' }}>
                    <div className={styles.viewToggle}>
                        <button
                            className={`${styles.toggleButton} ${periodMode === 'month' ? styles.active : ''}`}
                            onClick={() => setPeriodMode('month')}
                        >
                            Mês
                        </button>
                        <button
                            className={`${styles.toggleButton} ${periodMode === 'custom' ? styles.active : ''}`}
                            onClick={() => setPeriodMode('custom')}
                        >
                            Intervalo
                        </button>
                    </div>

                    {periodMode === 'month' ? (
                        <div className={styles.navGroup}>
                            <button
                                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                                className={styles.navButton}
                                title="Mês anterior"
                            >
                                &lt;
                            </button>
                            <span className={styles.currentMonth}>
                                {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                            </span>
                            <button
                                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                                className={styles.navButton}
                                title="Próximo mês"
                            >
                                &gt;
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'nowrap' }}>
                            <input
                                type="date"
                                value={customStart}
                                onChange={(e) => {
                                    const nextStart = e.target.value;
                                    setCustomStart(nextStart);
                                    if (customEnd && nextStart > customEnd) {
                                        setCustomEnd(nextStart);
                                    }
                                }}
                                className={styles.input}
                                style={{ minWidth: '132px', padding: '0.45rem 0.55rem' }}
                            />
                            <span style={{ color: '#64748b', fontWeight: 700, fontSize: '0.78rem' }}>até</span>
                            <input
                                type="date"
                                value={customEnd}
                                onChange={(e) => {
                                    const nextEnd = e.target.value;
                                    setCustomEnd(nextEnd);
                                    if (customStart && nextEnd < customStart) {
                                        setCustomStart(nextEnd);
                                    }
                                }}
                                className={styles.input}
                                style={{ minWidth: '132px', padding: '0.45rem 0.55rem' }}
                            />
                        </div>
                    )}
                </div>

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'nowrap' }}>
                    <div className={styles.selectWrapper} style={{ gap: '0.3rem' }}>
                        <label style={{ fontWeight: 600, color: '#64748b', fontSize: '0.78rem' }}>Acomodação:</label>
                        <select
                            value={selectedRoomId}
                            onChange={(e) => setSelectedRoomId(e.target.value)}
                            className={styles.input}
                            style={{ minWidth: '170px', padding: '0.45rem 0.55rem' }}
                        >
                            <option value={ALL_ROOMS_VALUE}>Todos os quartos (Lista)</option>
                            {roomTypes.map(room => (
                                <option key={room.id} value={room.id}>{room.name}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        className={styles.buttonPrimary}
                        onClick={() => setBulkModalOpen(true)}
                        title="Editar múltiplos dias de uma vez (preço, restrições e quartos disponíveis)"
                        style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
                    >
                        ⚡ Edição em Lote
                    </button>
                </div>
            </div>

            {toast && (
                <div
                    style={{
                        marginTop: '0.75rem',
                        padding: '0.7rem 1rem',
                        borderRadius: '10px',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        border: toast.type === 'success' ? '1px solid #bbf7d0' : toast.type === 'error' ? '1px solid #fecaca' : '1px solid #bfdbfe',
                        background: toast.type === 'success' ? '#f0fdf4' : toast.type === 'error' ? '#fef2f2' : '#eff6ff',
                        color: toast.type === 'success' ? '#166534' : toast.type === 'error' ? '#991b1b' : '#1d4ed8',
                    }}
                >
                    {toast.message}
                </div>
            )}

            {calendarError && (
                <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: '12px' }}>
                    {calendarError}
                </div>
            )}
            {calendarLoading && (
                <div style={{ marginTop: calendarError ? '0.5rem' : '0.75rem', padding: '0.5rem 1rem', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', borderRadius: '12px' }}>
                    Carregando calendário...
                </div>
            )}

            {loading ? (
                <div className={styles.loading}>Carregando...</div>
            ) : (
                <>
                    {false ? (
                        <div className={styles.calendarGrid}>
                            {weekDays.map(day => (
                                <div key={day} className={styles.weekDay}>{day}</div>
                            ))}
                            
                            {days.map((day, idx) => {
                                const rate = getRateForDay(day);
                                const data = getDataForDay(day);
                                const isCurrentMonth = isSameMonth(day, currentDate);
                                const isToday = isSameDay(day, new Date());
                                
                                return (
                                    <div 
                                        key={idx} 
                                        className={`${styles.dayCell} ${!isCurrentMonth ? styles.empty : ''} ${rate ? styles.hasRate : ''} ${rate?.stopSell ? styles.blocked : ''}`}
                                        onClick={() => isCurrentMonth && handleDateClick(day)}
                                        style={{ opacity: isCurrentMonth ? 1 : 0.3 }}
                                    >
                                        <div className={styles.dayNumber} style={{ color: isToday ? '#2563eb' : 'inherit' }}>
                                            {getDate(day)}
                                        </div>
                                        {isCurrentMonth && (
                                            <>
                                                <div className={styles.priceTag}>
                                                    {data?.stopSell || (data?.available === 0) ? (
                                                        <span style={{color: 'red'}}>FECHADO</span>
                                                    ) : (
                                                        `R$ ${Number(data?.price || 0).toFixed(2)}`
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                                                    Disp: {data?.available ?? '-'}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className={styles.listViewContainer}>
                            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontSize: '0.8rem', fontWeight: 600 }}>
                                Exibindo período: {listStartLabel} a {listEndLabel} | Hoje: {todayLabel} | {selectedRoomId === ALL_ROOMS_VALUE ? `Visualização: ${listRoomTypes.length} acomodações` : 'Visualização: 1 acomodação'} | {periodMode === 'custom' ? `Intervalo selecionado: ${listQueryStartLabel} a ${listEndLabel}` : 'Modo mensal (a partir de hoje)'} | Role horizontalmente para ver todos os dias
                            </div>
                            <div
                                className={`${styles.listViewWrapper} ${isListDragging ? styles.listViewWrapperDragging : ''}`}
                                ref={listScrollRef}
                                onMouseDown={handleListMouseDown}
                                onMouseMove={handleListMouseMove}
                                onMouseUp={stopListDragging}
                                onMouseLeave={stopListDragging}
                            >
                                <table className={styles.listViewTable}>
                                    <thead>
                                        <tr>
                                            <th className={styles.stickyCol}>Data</th>
                                            {monthDays.map(day => {
                                                 const dateKey = format(day, 'yyyy-MM-dd');
                                                 const isTodayCol = dateKey === todayKey;
                                                  const isWeekend = day.getDay() === 5 || day.getDay() === 6;
                                                  return (
                                                    <th
                                                        key={dateKey}
                                                        data-date={dateKey}
                                                        className={isTodayCol ? styles.todayColumnHeader : ''}
                                                        style={{ background: isTodayCol ? '#dbeafe' : (isWeekend ? '#f1f5f9' : 'white') }}
                                                    >
                                                        <div style={{fontSize: '0.78rem', color: '#64748b'}}>{format(day, 'EEE', { locale: ptBR })}</div>
                                                        <div style={{fontSize: '1rem'}}>{format(day, 'dd')}</div>
                                                        {isTodayCol && (
                                                            <div className={styles.todayLabel}>HOJE</div>
                                                        )}
                                                    </th>
                                                  );
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {listRoomTypes.map(renderListRowsForRoom)}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}

            {modalOpen && (
                <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
                    <div 
                        className={styles.modal} 
                        onClick={e => e.stopPropagation()} 
                        style={{ 
                            width: '480px', 
                            padding: '0', 
                            borderRadius: '16px', 
                            overflow: 'hidden',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                        }}
                    >
                        {/* Header */}
                        <div style={{ 
                            padding: '1.5rem', 
                            borderBottom: '1px solid #e2e8f0',
                            background: '#f8fafc'
                        }}>
                            <h2 style={{ 
                                fontSize: '1.25rem', 
                                fontWeight: 600, 
                                color: '#1e293b',
                                margin: 0 
                            }}>
                                Editar Tarifa
                            </h2>
                            <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                                {selectedDate && format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </p>
                        </div>
                        
                        <div style={{ padding: '1.5rem' }}>
                            {/* Price & MinLos Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div className={styles.formGroup}>
                                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem', display: 'block' }}>
                                        Valor da Diária (R$)
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>R$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editPrice}
                                            onChange={e => setEditPrice(e.target.value)}
                                            className={styles.input}
                                            style={{ paddingLeft: '2.5rem', width: '100%' }}
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <div className={styles.formGroup}>
                                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem', display: 'block' }}>
                                        Min. Noites
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={editMinLos}
                                        onChange={e => setEditMinLos(e.target.value)}
                                        className={styles.input}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '10px', background: '#f8fafc' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem', display: 'block' }}>
                                    Quartos Disponíveis (Inventário)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={editInventory}
                                    onChange={e => setEditInventory(e.target.value)}
                                    className={styles.input}
                                    style={{ width: '100%', marginBottom: '0.6rem' }}
                                />
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', fontSize: '0.78rem', color: '#475569' }}>
                                    <span>Disponíveis: <strong>{selectedDayData?.available ?? '-'}</strong></span>
                                    <span>Reservados: <strong>{selectedDayData?.bookingsCount ?? '-'}</strong></span>
                                    <span>Capacidade: <strong>{selectedDayData?.capacityTotal ?? '-'}</strong></span>
                                    <span>Ocupação: <strong>{selectedDayOccupancy.occupancyPct === null ? '—' : `${Math.round(selectedDayOccupancy.occupancyPct)}%`}</strong></span>
                                </div>
                            </div>

                            {/* Restrictions Cards */}
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.75rem', display: 'block' }}>
                                Restrições
                            </label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <label
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '1rem',
                                        border: editStopSell ? '1px solid #fecaca' : '1px solid #e2e8f0',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        background: editStopSell ? '#fef2f2' : 'white',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={editStopSell}
                                        onChange={e => setEditStopSell(e.target.checked)}
                                        style={{ width: '1.1rem', height: '1.1rem', marginRight: '1rem', accentColor: '#ef4444' }}
                                    />
                                    <div>
                                        <div style={{ fontWeight: 600, color: editStopSell ? '#b91c1c' : '#1e293b' }}>Fechar Venda (Stop Sell)</div>
                                        <div style={{ fontSize: '0.8rem', color: editStopSell ? '#b91c1c' : '#64748b' }}>Impede novas reservas para este dia</div>
                                    </div>
                                </label>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                    <label
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '0.75rem',
                                            border: editCta ? '1px solid #fed7aa' : '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            background: editCta ? '#fff7ed' : 'white'
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={editCta}
                                            onChange={e => setEditCta(e.target.checked)}
                                            style={{ marginRight: '0.75rem', accentColor: '#f97316' }}
                                        />
                                        <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#334155' }}>Bloquear Entrada</span>
                                    </label>

                                    <label
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '0.75rem',
                                            border: editCtd ? '1px solid #fed7aa' : '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            background: editCtd ? '#fff7ed' : 'white'
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={editCtd}
                                            onChange={e => setEditCtd(e.target.checked)}
                                            style={{ marginRight: '0.75rem', accentColor: '#f97316' }}
                                        />
                                        <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#334155' }}>Bloquear Saída</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                        {/* Footer Actions */}
                        <div style={{ 
                            padding: '1.5rem', 
                            background: '#f8fafc', 
                            borderTop: '1px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                {existingRateId && (
                                    <button 
                                        onClick={handleDelete}
                                        className={styles.button}
                                        style={{ 
                                            background: 'transparent', 
                                            color: '#ef4444', 
                                            border: '1px solid #fee2e2',
                                            padding: '0.5rem 1rem',
                                            fontSize: '0.875rem'
                                        }}
                                        title="Remover personalização e voltar ao padrão"
                                    >
                                        🗑️ Restaurar Padrão
                                    </button>
                                )}
                            </div>
                            
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button 
                                    onClick={() => setModalOpen(false)}
                                    className={styles.buttonSecondary}
                                    style={{ background: 'white', border: '1px solid #e2e8f0' }}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleSave}
                                    className={styles.buttonPrimary}
                                    style={{ padding: '0.6rem 1.5rem' }}
                                    disabled={modalSaving}
                                >
                                    {modalSaving ? 'Salvando...' : 'Salvar Alterações'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {bulkModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setBulkModalOpen(false)}>
                    <div data-testid="bulk-modal" className={`${styles.modal} ${styles.bulkEditModal}`} onClick={e => e.stopPropagation()}>
                        <div className={styles.bulkEditHeader}>
                            <div>
                                <h2 className={styles.modalTitle}>Edição em Lote</h2>
                                <p className={styles.bulkEditSubtitle}>
                                    Atualize tarifas, inventário e restrições de vários dias de uma vez.
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setBulkModalOpen(false)}
                                className={styles.bulkEditClose}
                                aria-label="Fechar edição em lote"
                            >
                                &times;
                            </Button>
                        </div>

                        <div className={styles.bulkEditBody}>
                            <section className={styles.bulkSection}>
                                <div className={styles.bulkSectionHeader}>
                                    <Badge variant="secondary" className={styles.bulkSectionBadge}>Bloco 1</Badge>
                                    <h3 className={styles.bulkSectionTitle}>Escopo</h3>
                                </div>
                                <div className={styles.bulkScopeGrid}>
                                    <div className={styles.formGroup}>
                                        <label className={styles.bulkLabel} htmlFor="bulk-room-type">Tipo de quarto</label>
                                        <select
                                            id="bulk-room-type"
                                            value={bulkRoomTypeId}
                                            onChange={e => setBulkRoomTypeId(e.target.value)}
                                            className={styles.input}
                                        >
                                            <option value="all">Todos os tipos</option>
                                            {roomTypes.map(room => (
                                                <option key={room.id} value={room.id}>{room.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label className={styles.bulkLabel} htmlFor="bulk-start-date">Data inicial</label>
                                        <input
                                            id="bulk-start-date"
                                            type="date"
                                            value={bulkStart}
                                            onChange={e => setBulkStart(e.target.value)}
                                            className={styles.input}
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label className={styles.bulkLabel} htmlFor="bulk-end-date">Data final</label>
                                        <input
                                            id="bulk-end-date"
                                            type="date"
                                            value={bulkEnd}
                                            onChange={e => setBulkEnd(e.target.value)}
                                            className={styles.input}
                                        />
                                    </div>
                                </div>

                                <div className={styles.bulkWeekdaySection}>
                                    <div className={styles.bulkWeekdayHeader}>
                                        <div>
                                            <p className={styles.bulkLabel}>Dias da semana</p>
                                            <span className={styles.bulkHelperText}>Selecione manualmente ou use um preset rápido.</span>
                                        </div>
                                        <div className={styles.bulkPresetRow}>
                                            <Button type="button" variant="outline" size="sm" className={styles.bulkPresetButton} onClick={() => setBulkWeekdays(applyWeekdayPreset('all'))}>
                                                Todos
                                            </Button>
                                            <Button type="button" variant="outline" size="sm" className={styles.bulkPresetButton} onClick={() => setBulkWeekdays(applyWeekdayPreset('weekdays'))}>
                                                Dias da Semana
                                            </Button>
                                            <Button type="button" variant="outline" size="sm" className={styles.bulkPresetButton} onClick={() => setBulkWeekdays(applyWeekdayPreset('weekend'))}>
                                                Fim de Semana
                                            </Button>
                                        </div>
                                    </div>
                                    <div className={styles.weekdayGrid}>
                                        {WEEKDAYS.map(weekday => (
                                            <label key={weekday.day} className={styles.weekdayCheckbox}>
                                                <input
                                                    type="checkbox"
                                                    checked={bulkWeekdays[weekday.day]}
                                                    onChange={() => toggleWeekday(weekday.day)}
                                                />
                                                <span>{weekday.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </section>

                            <section className={styles.bulkSection}>
                                <div className={styles.bulkSectionHeader}>
                                    <Badge variant="secondary" className={styles.bulkSectionBadge}>Bloco 2</Badge>
                                    <h3 className={styles.bulkSectionTitle}>Tarifas e permanência</h3>
                                </div>
                                <div className={styles.bulkFieldGrid}>
                                    <div
                                        className={`${styles.bulkFieldCard} ${!bulkFieldToggles.price ? styles.bulkFieldCardDisabled : ''}`}
                                        aria-disabled={!bulkFieldToggles.price}
                                    >
                                        <label className={styles.bulkToggleRow}>
                                            <input
                                                type="checkbox"
                                                checked={bulkFieldToggles.price}
                                                onChange={() => toggleBulkField('price')}
                                            />
                                            <span>Alterar preço da diária</span>
                                        </label>
                                        <p className={styles.bulkFieldDescription}>Aplica um novo valor de diária ao período e aos dias selecionados.</p>
                                        <input
                                            type="number"
                                            placeholder="Ex.: 299"
                                            value={bulkFieldValues.price}
                                            onChange={e => setBulkFieldValue('price', e.target.value)}
                                            className={styles.input}
                                            disabled={!bulkFieldToggles.price}
                                        />
                                    </div>
                                    <div
                                        className={`${styles.bulkFieldCard} ${!bulkFieldToggles.minLos ? styles.bulkFieldCardDisabled : ''}`}
                                        aria-disabled={!bulkFieldToggles.minLos}
                                    >
                                        <label className={styles.bulkToggleRow}>
                                            <input
                                                type="checkbox"
                                                checked={bulkFieldToggles.minLos}
                                                onChange={() => toggleBulkField('minLos')}
                                            />
                                            <span>Alterar mínimo de noites</span>
                                        </label>
                                        <p className={styles.bulkFieldDescription}>Define a permanência mínima exigida para os dias afetados.</p>
                                        <input
                                            type="number"
                                            min="1"
                                            placeholder="Ex.: 2"
                                            value={bulkFieldValues.minLos}
                                            onChange={e => setBulkFieldValue('minLos', e.target.value)}
                                            className={styles.input}
                                            disabled={!bulkFieldToggles.minLos}
                                        />
                                    </div>
                                </div>
                            </section>

                            <section className={styles.bulkSection}>
                                <div className={styles.bulkSectionHeader}>
                                    <Badge variant="secondary" className={styles.bulkSectionBadge}>Bloco 3</Badge>
                                    <h3 className={styles.bulkSectionTitle}>Inventário e restrições</h3>
                                </div>
                                <div className={styles.bulkFieldGrid}>
                                    <div
                                        className={`${styles.bulkFieldCard} ${!bulkFieldToggles.inventory ? styles.bulkFieldCardDisabled : ''}`}
                                        aria-disabled={!bulkFieldToggles.inventory}
                                    >
                                        <div className={styles.bulkFieldMeta}>
                                            <div className={styles.bulkInventoryModeGroup} role="radiogroup" aria-label="Tipo de inventário">
                                                <button
                                                    type="button"
                                                    className={`${styles.bulkInventoryModeButton} ${bulkInventoryTarget === 'standard' ? styles.bulkInventoryModeButtonActive : ''}`}
                                                    onClick={() => setBulkInventoryTarget('standard')}
                                                    aria-pressed={bulkInventoryTarget === 'standard'}
                                                >
                                                    Standard
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`${styles.bulkInventoryModeButton} ${bulkInventoryTarget === 'fourGuests' ? styles.bulkInventoryModeButtonActive : ''}`}
                                                    onClick={() => setBulkInventoryTarget('fourGuests')}
                                                    aria-pressed={bulkInventoryTarget === 'fourGuests'}
                                                >
                                                    Quadruplo
                                                </button>
                                            </div>
                                        </div>
                                        <label className={styles.bulkToggleRow}>
                                            <input
                                                type="checkbox"
                                                checked={bulkFieldToggles.inventory}
                                                onChange={() => toggleBulkField('inventory')}
                                            />
                                            <span>Alterar quantidade de quartos disponíveis</span>
                                        </label>
                                        <p className={styles.bulkFieldDescription}>
                                            {bulkInventoryTarget === 'fourGuests'
                                                ? 'Atualiza o inventário diário do quadruplo, respeitando a capacidade especial de 4 hóspedes.'
                                                : 'Atualiza o inventário diário do standard, sem mudar a regra atual do backend.'}
                                        </p>
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder="Ex.: 4"
                                            value={bulkFieldValues.inventory}
                                            onChange={e => setBulkFieldValue('inventory', e.target.value)}
                                            className={styles.input}
                                            disabled={!bulkFieldToggles.inventory}
                                        />
                                        <span className={styles.bulkFieldFootnote}>
                                            {bulkInventoryTarget === 'fourGuests'
                                                ? 'Bulk edit deste campo afeta apenas a disponibilidade do quadruplo.'
                                                : 'Bulk edit deste campo afeta apenas a disponibilidade padrão.'}
                                        </span>
                                    </div>
                                    <div
                                        className={`${styles.bulkFieldCard} ${!bulkFieldToggles.stopSell ? styles.bulkFieldCardDisabled : ''}`}
                                        aria-disabled={!bulkFieldToggles.stopSell}
                                    >
                                        <label className={styles.bulkToggleRow}>
                                            <input
                                                type="checkbox"
                                                checked={bulkFieldToggles.stopSell}
                                                onChange={() => toggleBulkField('stopSell')}
                                            />
                                            <span>Alterar Stop Sell</span>
                                        </label>
                                        <p className={styles.bulkFieldDescription}>Fecha ou reabre a venda para os dias selecionados.</p>
                                        <select
                                            aria-label="Valor de Stop Sell"
                                            value={bulkFieldValues.stopSell}
                                            onChange={(e) => setBulkFieldValue('stopSell', e.target.value as '' | 'true' | 'false')}
                                            className={styles.input}
                                            disabled={!bulkFieldToggles.stopSell}
                                        >
                                            <option value="">Selecionar ação</option>
                                            <option value="true">Fechar venda</option>
                                            <option value="false">Abrir venda</option>
                                        </select>
                                    </div>
                                    <div
                                        className={`${styles.bulkFieldCard} ${!bulkFieldToggles.cta ? styles.bulkFieldCardDisabled : ''}`}
                                        aria-disabled={!bulkFieldToggles.cta}
                                    >
                                        <label className={styles.bulkToggleRow}>
                                            <input
                                                type="checkbox"
                                                checked={bulkFieldToggles.cta}
                                                onChange={() => toggleBulkField('cta')}
                                            />
                                            <span>Alterar CTA</span>
                                        </label>
                                        <p className={styles.bulkFieldDescription}>Bloqueia ou libera entrada nos dias afetados.</p>
                                        <select
                                            aria-label="Valor de CTA"
                                            value={bulkFieldValues.cta}
                                            onChange={(e) => setBulkFieldValue('cta', e.target.value as '' | 'true' | 'false')}
                                            className={styles.input}
                                            disabled={!bulkFieldToggles.cta}
                                        >
                                            <option value="">Selecionar ação</option>
                                            <option value="true">Bloquear entrada</option>
                                            <option value="false">Liberar entrada</option>
                                        </select>
                                    </div>
                                    <div
                                        className={`${styles.bulkFieldCard} ${!bulkFieldToggles.ctd ? styles.bulkFieldCardDisabled : ''}`}
                                        aria-disabled={!bulkFieldToggles.ctd}
                                    >
                                        <label className={styles.bulkToggleRow}>
                                            <input
                                                type="checkbox"
                                                checked={bulkFieldToggles.ctd}
                                                onChange={() => toggleBulkField('ctd')}
                                            />
                                            <span>Alterar CTD</span>
                                        </label>
                                        <p className={styles.bulkFieldDescription}>Bloqueia ou libera saída nos dias afetados.</p>
                                        <select
                                            aria-label="Valor de CTD"
                                            value={bulkFieldValues.ctd}
                                            onChange={(e) => setBulkFieldValue('ctd', e.target.value as '' | 'true' | 'false')}
                                            className={styles.input}
                                            disabled={!bulkFieldToggles.ctd}
                                        >
                                            <option value="">Selecionar ação</option>
                                            <option value="true">Bloquear saída</option>
                                            <option value="false">Liberar saída</option>
                                        </select>
                                    </div>
                                </div>
                            </section>
                        </div>

                        <div className={styles.bulkImpactSummary}>
                            <span className={styles.bulkImpactLabel}>Resumo de impacto</span>
                            <strong>
                                Serão atualizados: {bulkAffectedDaysCount} {bulkAffectedDaysCount === 1 ? 'dia' : 'dias'} • {bulkScopeLabel}
                            </strong>
                            <span className={styles.bulkImpactHint}>
                                {bulkHasActiveFields
                                    ? 'Somente os campos ativados serão enviados no submit.'
                                    : 'Ative ao menos um campo para aplicar alterações em lote.'}
                            </span>
                        </div>

                        <div className={`${styles.modalActions} ${styles.bulkEditActions}`}>
                            <Button
                                onClick={() => setBulkModalOpen(false)}
                                variant="ghost"
                                className={styles.bulkActionGhost}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                onClick={clearBulkFields}
                                variant="outline"
                                className={styles.bulkActionSecondary}
                            >
                                Limpar campos
                            </Button>
                            <Button
                                onClick={handleBulkSave}
                                className={styles.bulkActionPrimary}
                                disabled={!bulkHasActiveFields}
                            >
                                Aplicar alterações em lote
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {inventorySelection && (
                <div
                    className={styles.inventoryBatchPopover}
                    style={{
                        left: `${Math.min(inventorySelection.anchorRect.left, (typeof window !== 'undefined' ? window.innerWidth : 1280) - 280)}px`,
                        top: `${inventorySelection.anchorRect.bottom + 10}px`,
                    }}
                    data-inventory-batch-popover="true"
                >
                    <strong className={styles.inventoryBatchTitle}>
                        {getSelectionTitle(inventorySelection.field, inventorySelection.dates.length)}
                    </strong>
                    <label className={styles.inventoryBatchLabel}>
                        {isNumericSelectionField(inventorySelection.field) ? 'Valor' : 'Ação'}
                        {isNumericSelectionField(inventorySelection.field) ? (
                            <input
                                type="number"
                                min={inventorySelection.field === 'minLos' ? '1' : '0'}
                                value={inventoryBatchValue}
                                onChange={(event) => setInventoryBatchValue(event.target.value)}
                                className={styles.inventoryBatchInput}
                                aria-label={getSelectionInputLabel(inventorySelection.field)}
                            />
                        ) : (
                            <select
                                value={inventoryBatchValue}
                                onChange={(event) => setInventoryBatchValue(event.target.value)}
                                className={styles.inventoryBatchInput}
                                aria-label={getSelectionInputLabel(inventorySelection.field)}
                            >
                                <option value="">Selecionar ação</option>
                                <option value="true">
                                    {inventorySelection.field === 'cta'
                                        ? 'Bloquear entrada'
                                        : inventorySelection.field === 'ctd'
                                            ? 'Bloquear saída'
                                            : 'Ativar'}
                                </option>
                                <option value="false">
                                    {inventorySelection.field === 'cta'
                                        ? 'Liberar entrada'
                                        : inventorySelection.field === 'ctd'
                                            ? 'Liberar saída'
                                            : 'Desativar'}
                                </option>
                            </select>
                        )}
                    </label>
                    <div className={styles.inventoryBatchActions}>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={clearInventorySelection}
                            disabled={inventoryBatchSaving}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            onClick={applyInventorySelectionValue}
                            disabled={inventoryBatchSaving || !inventoryBatchValue.trim()}
                        >
                            Aplicar
                        </Button>
                    </div>
                </div>
            )}
        </>
    );
}
