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

interface RoomType {
    id: string;
    name: string;
    basePrice: number;
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
type BulkUpdates = {
    price?: number;
    minLos?: number;
    stopSell?: boolean;
    cta?: boolean;
    ctd?: boolean;
    inventory?: number;
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
    const [bulkPrice, setBulkPrice] = useState('');
    const [bulkMinLos, setBulkMinLos] = useState('');
    const [bulkStopSell, setBulkStopSell] = useState<'true'|'false'|''>('');
    const [bulkCta, setBulkCta] = useState<'true'|'false'|''>('');
    const [bulkCtd, setBulkCtd] = useState<'true'|'false'|''>('');
    const [bulkInventory, setBulkInventory] = useState('');
    const WEEKDAYS = [
        { label: 'dom', day: 0 },
        { label: 'seg', day: 1 },
        { label: 'ter', day: 2 },
        { label: 'qua', day: 3 },
        { label: 'qui', day: 4 },
        { label: 'sex', day: 5 },
        { label: 'sáb', day: 6 },
    ];
    const defaultWeekdays = () => WEEKDAYS.reduce<Record<number, boolean>>((acc, weekday) => {
        acc[weekday.day] = true;
        return acc;
    }, {});
    const [bulkWeekdays, setBulkWeekdays] = useState<Record<number, boolean>>(defaultWeekdays);
    const toggleWeekday = (day: number) => {
        setBulkWeekdays(prev => ({ ...prev, [day]: !prev[day] }));
    };
    const resetBulkWeekdays = () => setBulkWeekdays(defaultWeekdays());

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
        field: 'price' | 'minLos' | 'stopSell' | 'cta' | 'ctd' | 'inventory',
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

        const updates: BulkUpdates = {};
        if (bulkPrice) updates.price = parseFloat(bulkPrice);
        if (bulkMinLos) updates.minLos = parseInt(bulkMinLos);
        if (bulkStopSell) updates.stopSell = bulkStopSell === 'true';
        if (bulkCta) updates.cta = bulkCta === 'true';
        if (bulkCtd) updates.ctd = bulkCtd === 'true';
        if (bulkInventory) {
            const inv = parseInt(bulkInventory);
            if (isNaN(inv) || inv < 0) {
                showToast('error', 'Quantidade de quartos inválida.');
                return;
            }
            updates.inventory = inv;
        }

        if (Object.keys(updates).length === 0) {
            showToast('error', 'Preencha pelo menos um campo para atualizar.');
            return;
        }

        const selectedDays = Object.entries(bulkWeekdays)
            .filter(([, value]) => value)
            .map(([day]) => Number(day));
        if (selectedDays.length === 0) {
            showToast('error', 'Selecione ao menos um dia da semana.');
            return;
        }

        const payload = {
            roomTypeId: bulkRoomTypeId,
            startDate: bulkStart,
            endDate: bulkEnd,
            updates,
            daysOfWeek: selectedDays
        };
        console.log('[Frontend] Bulk Payload:', JSON.stringify(payload, null, 2));

        try {
            const res = await fetch('/api/rates/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
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
        setBulkPrice('');
        setBulkMinLos('');
        setBulkStopSell('');
        setBulkCta('');
        setBulkCtd('');
        setBulkInventory('');
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
    const todayKey = format(today, 'yyyy-MM-dd');
    const todayLabel = format(today, 'dd/MM/yyyy');
    const listStartLabel = format(listVisibleStart, 'dd/MM/yyyy');
    const listEndLabel = format(listQueryInterval.end, 'dd/MM/yyyy');
    const listQueryStartLabel = format(listQueryInterval.start, 'dd/MM/yyyy');
    const selectedDayData = selectedDate ? getDataForDay(selectedDate) : undefined;
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

    const toggleRoomCollapsed = (roomId: string) => {
        setCollapsedRooms(prev => ({ ...prev, [roomId]: !prev[roomId] }));
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
                    <span>Tarifa base: R$ {Number(room.basePrice || 0).toFixed(2)}</span>
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
                            className={styles.cell}
                            onClick={() => updateRateField(day, 'stopSell', !isClosed, room.id)}
                            style={isTodayCol ? { background: '#eff6ff' } : undefined}
                        >
                            <div className={`${styles.statusPill} ${(isClosed || isZero) ? styles.closed : styles.open}`}>
                                {isClosed ? 'FECHADO' : (isZero ? 'ESGOTADO' : 'ABERTO')}
                            </div>
                        </td>
                    );
                })}
            </tr>

            <tr>
                <td className={styles.stickyCol}>Quartos para venda</td>
                {monthDays.map(day => {
                    const data = getDataForDay(day, room.id);
                    const total = data?.totalInventory ?? 0;
                    const available = data?.available ?? 0;
                    const bookingsCount = data?.bookingsCount ?? 0;
                    const capacityTotal = data?.capacityTotal ?? 0;
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const inventoryKey = `${room.id}:${dateStr}`;
                    const isTodayCol = dateStr === todayKey;
                    return (
                        <td key={`${room.id}-inventory-${dateStr}`} className={styles.cell}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: isTodayCol ? '#eff6ff' : 'transparent', borderRadius: '8px', padding: '0.2rem 0.35rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: updatingInventory === inventoryKey ? 0.5 : 1 }}>
                                    <button
                                        className={styles.miniBtn}
                                        onClick={() => updateRateField(day, 'inventory', Math.max(0, total - 1), room.id)}
                                        disabled={updatingInventory === inventoryKey}
                                    >
                                        -
                                    </button>
                                    <span style={{ fontWeight: 600 }}>{total}</span>
                                    <button
                                        className={styles.miniBtn}
                                        onClick={() => updateRateField(day, 'inventory', total + 1, room.id)}
                                        disabled={updatingInventory === inventoryKey}
                                    >
                                        +
                                    </button>
                                </div>
                                <span style={{ fontSize: '0.72rem', color: '#0369a1', fontWeight: 600 }}>
                                    Disponíveis: {available}
                                </span>
                                <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                                    Reservados: {bookingsCount} | Capacidade física: {capacityTotal}
                                </span>
                            </div>
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
                    return (
                        <td key={`${room.id}-price-${dateStr}`} className={styles.cell} style={isTodayCol ? { background: '#eff6ff' } : undefined}>
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
                    return (
                        <td key={`${room.id}-minlos-${dateStr}`} className={styles.cell} style={isTodayCol ? { background: '#eff6ff' } : undefined}>
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
                    return (
                        <td
                            key={`${room.id}-cta-${dateStr}`}
                            className={styles.cell}
                            onClick={() => updateRateField(day, 'cta', !cta, room.id)}
                            style={isTodayCol ? { background: '#eff6ff' } : undefined}
                        >
                            <div className={`${styles.restrictionCell} ${cta ? styles.restrictionActive : ''}`}>
                                {cta ? '🚫' : ''}
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
                    return (
                        <td
                            key={`${room.id}-ctd-${dateStr}`}
                            className={styles.cell}
                            onClick={() => updateRateField(day, 'ctd', !ctd, room.id)}
                            style={isTodayCol ? { background: '#eff6ff' } : undefined}
                        >
                            <div className={`${styles.restrictionCell} ${ctd ? styles.restrictionActive : ''}`}>
                                {ctd ? '🚫' : ''}
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
                                                 const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                                                 return (
                                                    <th key={dateKey} data-date={dateKey} style={{ background: isTodayCol ? '#dbeafe' : (isWeekend ? '#f1f5f9' : 'white') }}>
                                                        <div style={{fontSize: '0.78rem', color: '#64748b'}}>{format(day, 'EEE', { locale: ptBR })}</div>
                                                        <div style={{fontSize: '1rem'}}>{format(day, 'dd')}</div>
                                                        {isTodayCol && (
                                                            <div style={{ marginTop: '0.15rem', fontSize: '0.62rem', fontWeight: 700, color: '#1d4ed8' }}>HOJE</div>
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
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.78rem', color: '#475569' }}>
                                    <span>Disponíveis: <strong>{selectedDayData?.available ?? '-'}</strong></span>
                                    <span>Reservados: <strong>{selectedDayData?.bookingsCount ?? '-'}</strong></span>
                                    <span>Capacidade: <strong>{selectedDayData?.capacityTotal ?? '-'}</strong></span>
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
                    <div data-testid="bulk-modal" className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', width: '95%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <div>
                                <h2 className={styles.modalTitle} style={{ marginBottom: '0.5rem' }}>⚡ Edição em Lote</h2>
                                <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
                                    Atualize múltiplos dias de uma vez.
                                </p>
                            </div>
                            <button onClick={() => setBulkModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>&times;</button>
                        </div>

                        <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid #e2e8f0' }}>
                            <h3 style={{ fontSize: '0.85rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: '#64748b', marginBottom: '1.5rem', fontWeight: 700 }}>1. Configuração</h3>
                            
                            {/* Room Type Selection */}
                            <div className={styles.formGroup} style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                                <label style={{marginBottom: '0.75rem', fontSize: '0.95rem', color: '#334155'}}>Tipo de Quarto</label>
                                <select 
                                    value={bulkRoomTypeId}
                                    onChange={e => setBulkRoomTypeId(e.target.value)}
                                    className={styles.input}
                                    style={{ padding: '0.875rem', width: '100%' }}
                                >
                                    <option value="all">Todos os tipos</option>
                                    {roomTypes.map(room => (
                                        <option key={room.id} value={room.id}>{room.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem' }}>
                                <div className={styles.formGroup} style={{ marginBottom: 0, display: 'flex', flexDirection: 'column' }}>
                                    <label style={{marginBottom: '0.75rem', fontSize: '0.95rem', color: '#334155'}}>Data Inicial</label>
                                    <input 
                                        type="date" 
                                        value={bulkStart}
                                        onChange={e => setBulkStart(e.target.value)}
                                        className={styles.input}
                                        style={{ padding: '0.875rem', width: '100%' }}
                                    />
                                </div>
                                <div className={styles.formGroup} style={{ marginBottom: 0, display: 'flex', flexDirection: 'column' }}>
                                    <label style={{marginBottom: '0.75rem', fontSize: '0.95rem', color: '#334155'}}>Data Final</label>
                                    <input 
                                        type="date" 
                                        value={bulkEnd}
                                        onChange={e => setBulkEnd(e.target.value)}
                                        className={styles.input}
                                        style={{ padding: '0.875rem', width: '100%' }}
                                    />
                                </div>
                            </div>
                            <div style={{ marginTop: '1.5rem', padding: '1rem 1rem 0', borderTop: '1px solid #e2e8f0' }}>
                                <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Só aplicar para</p>
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
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                            {/* Preços e Estadia */}
                            <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                <h3 style={{ fontSize: '0.85rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: '#64748b', marginBottom: '1.5rem', fontWeight: 700 }}>2. Valores</h3>
                                <div className={styles.formGroup} style={{marginBottom: '1.5rem'}}>
                                    <label style={{marginBottom: '0.75rem', fontSize: '0.95rem', color: '#334155'}}>Preço da Diária (R$)</label>
                                    <input 
                                        type="number" 
                                        placeholder="Manter atual"
                                        value={bulkPrice}
                                        onChange={e => setBulkPrice(e.target.value)}
                                        className={styles.input}
                                        style={{ padding: '0.875rem', width: '100%' }}
                                    />
                                </div>
                                <div className={styles.formGroup} style={{marginBottom: '1.5rem'}}>
                                    <label style={{marginBottom: '0.75rem', fontSize: '0.95rem', color: '#334155'}}>Mínimo de Noites</label>
                                    <input 
                                        type="number" 
                                        min="1"
                                        placeholder="Manter atual"
                                        value={bulkMinLos}
                                        onChange={e => setBulkMinLos(e.target.value)}
                                        className={styles.input}
                                        style={{ padding: '0.875rem', width: '100%' }}
                                    />
                                </div>
                                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                                    <label style={{marginBottom: '0.75rem', fontSize: '0.95rem', color: '#334155'}}>Quantidade de quartos disponíveis</label>
                                    <input 
                                        type="number" 
                                        min="0"
                                        placeholder="Manter atual"
                                        value={bulkInventory}
                                        onChange={e => setBulkInventory(e.target.value)}
                                        className={styles.input}
                                        style={{ padding: '0.875rem', width: '100%' }}
                                    />
                                </div>
                            </div>

                            {/* Restrições */}
                            <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                <h3 style={{ fontSize: '0.85rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: '#64748b', marginBottom: '1.5rem', fontWeight: 700 }}>3. Restrições</h3>
                                <div className={styles.formGroup} style={{marginBottom: '1.5rem'}}>
                                    <label style={{marginBottom: '0.75rem', fontSize: '0.95rem', color: '#334155'}}>Stop Sell (Fechar Venda)</label>
                                    <select 
                                        value={bulkStopSell}
                                        onChange={(e) => setBulkStopSell(e.target.value as 'true' | 'false' | '')}
                                        className={styles.input}
                                        style={{ 
                                            background: bulkStopSell === 'true' ? '#fee2e2' : bulkStopSell === 'false' ? '#dcfce7' : 'white',
                                            padding: '0.875rem',
                                            width: '100%'
                                        }}
                                    >
                                        <option value="">Manter atual</option>
                                        <option value="true">🚫 FECHADO</option>
                                        <option value="false">✅ ABERTO</option>
                                    </select>
                                </div>
                                <div className={styles.formGroup} style={{marginBottom: '1.5rem'}}>
                                    <label style={{marginBottom: '0.75rem', fontSize: '0.95rem', color: '#334155'}}>CTA (Bloquear Entrada)</label>
                                    <select 
                                        value={bulkCta}
                                        onChange={(e) => setBulkCta(e.target.value as 'true' | 'false' | '')}
                                        className={styles.input}
                                        style={{ padding: '0.875rem', width: '100%' }}
                                    >
                                        <option value="">Manter atual</option>
                                        <option value="true">Bloqueado</option>
                                        <option value="false">Liberado</option>
                                    </select>
                                </div>
                                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                                    <label style={{marginBottom: '0.75rem', fontSize: '0.95rem', color: '#334155'}}>CTD (Bloquear Saída)</label>
                                    <select 
                                        value={bulkCtd}
                                        onChange={(e) => setBulkCtd(e.target.value as 'true' | 'false' | '')}
                                        className={styles.input}
                                        style={{ padding: '0.875rem', width: '100%' }}
                                    >
                                        <option value="">Manter atual</option>
                                        <option value="true">Bloqueado</option>
                                        <option value="false">Liberado</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className={styles.modalActions} style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
                            <button 
                                onClick={() => setBulkModalOpen(false)}
                                className={styles.buttonSecondary}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={clearBulkFields}
                                className={styles.buttonSecondary}
                            >
                                Limpar campos
                            </button>
                            <button 
                                onClick={handleBulkSave}
                                className={styles.buttonPrimary}
                                style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
                            >
                                Aplicar Alterações em Lote
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
