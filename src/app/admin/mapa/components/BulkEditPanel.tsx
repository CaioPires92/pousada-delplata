'use client';

import React, { useState, useMemo } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
    Calendar, 
    Home, 
    DollarSign, 
    Package, 
    X, 
    Check, 
    ChevronRight,
    Users,
    Activity,
    Info,
    Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
    WEEKDAYS, 
    applyWeekdayPreset, 
    countAffectedDays 
} from '../bulk-edit';

interface RoomType {
    id: string;
    name: string;
    basePrice: number;
    capacity: number;
    inventoryFor4Guests?: number;
}

interface BulkEditPanelProps {
    roomTypes: RoomType[];
    initialStartDate?: string;
    initialEndDate?: string;
    onSave: (data: any) => Promise<void>;
    onCancel: () => void;
}

export const BulkEditPanel: React.FC<BulkEditPanelProps> = ({
    roomTypes,
    initialStartDate = '',
    initialEndDate = '',
    onSave,
    onCancel
}) => {
    // Scope State
    const [roomTypeId, setRoomTypeId] = useState('all');
    const [startDate, setStartDate] = useState(initialStartDate);
    const [endDate, setEndDate] = useState(initialEndDate);
    const [weekdays, setWeekdays] = useState<Record<number, boolean>>({
        0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true
    });

    // Actions State
    const [price, setPrice] = useState<string>('');
    const [minLos, setMinLos] = useState<string>('');
    const [inventoryStd, setInventoryStd] = useState<string>('');
    const [inventory4P, setInventory4P] = useState<string>('');
    const [stopSell, setStopSell] = useState<boolean | null>(null);
    const [cta, setCta] = useState<boolean | null>(null);
    const [ctd, setCtd] = useState<boolean | null>(null);

    const [isSaving, setIsSaving] = useState(false);

    // Helpers
    const toggleWeekday = (day: number) => {
        setWeekdays(prev => ({ ...prev, [day]: !prev[day] }));
    };

    const handlePreset = (preset: 'all' | 'weekdays' | 'weekend') => {
        setWeekdays(applyWeekdayPreset(preset));
    };

    const toggleTriState = (current: boolean | null, setter: (v: boolean | null) => void) => {
        if (current === null) setter(true); // Neutral -> Blocked
        else if (current === true) setter(false); // Blocked -> Active
        else setter(null); // Active -> Neutral
    };

    const hasChanges = useMemo(() => {
        return price !== '' || 
               minLos !== '' || 
               inventoryStd !== '' || 
               inventory4P !== '' || 
               stopSell !== null || 
               cta !== null || 
               ctd !== null;
    }, [price, minLos, inventoryStd, inventory4P, stopSell, cta, ctd]);

    const affectedDays = useMemo(() => {
        return countAffectedDays(startDate, endDate, weekdays);
    }, [startDate, endDate, weekdays]);

    const handleApply = async () => {
        if (!startDate || !endDate || !hasChanges || affectedDays === 0) return;

        const selectedWeekdays = Object.entries(weekdays)
            .filter(([_, active]) => active)
            .map(([day, _]) => parseInt(day));

        const updates: any = {};
        if (price !== '') updates.price = parseFloat(price);
        if (minLos !== '') updates.minLos = parseInt(minLos);
        if (inventoryStd !== '') updates.inventory = parseInt(inventoryStd);
        if (inventory4P !== '') updates.fourGuestInventory = parseInt(inventory4P);
        if (stopSell !== null) updates.stopSell = stopSell;
        if (cta !== null) updates.cta = cta;
        if (ctd !== null) updates.ctd = ctd;

        setIsSaving(true);
        try {
            await onSave({
                roomTypeId,
                startDate,
                endDate,
                updates,
                daysOfWeek: selectedWeekdays,
                inventoryTarget: inventory4P !== '' ? 'fourGuests' : 'standard'
            });
        } finally {
            setIsSaving(false);
        }
    };

    const selectedRoom = roomTypes.find(r => r.id === roomTypeId);
    const has4P = roomTypeId === 'all' || (selectedRoom?.inventoryFor4Guests ?? 0) > 0;

    return (
        <div className="flex flex-col max-h-[90vh] bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 max-w-2xl w-full mx-auto animate-in fade-in zoom-in duration-300">
            {/* Header */}
            <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-slate-800 rounded-xl shadow-lg shadow-slate-200">
                        <Zap className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Edição em Lote</h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ação Direta</p>
                    </div>
                </div>
                <button 
                    onClick={onCancel}
                    className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                    <X className="h-5 w-5 text-slate-400" />
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto scrollbar-hide">
                <div className="p-8 space-y-10">
                    
                    {/* BLOCO 1 - ESCOPO */}
                    <section className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="border-slate-200 text-slate-400 font-black text-[10px] px-2 py-0.5 rounded-md uppercase">01</Badge>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Definir Escopo</h3>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handlePreset('all')} className="text-[9px] font-black uppercase tracking-tighter text-slate-400 hover:text-slate-800 transition-colors">Todos</button>
                                <span className="text-slate-200">|</span>
                                <button onClick={() => handlePreset('weekdays')} className="text-[9px] font-black uppercase tracking-tighter text-slate-400 hover:text-slate-800 transition-colors">Semana</button>
                                <span className="text-slate-200">|</span>
                                <button onClick={() => handlePreset('weekend')} className="text-[9px] font-black uppercase tracking-tighter text-slate-400 hover:text-slate-800 transition-colors">Fim de Semana</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Acomodação</label>
                                <div className="relative">
                                    <select
                                        value={roomTypeId}
                                        onChange={(e) => setRoomTypeId(e.target.value)}
                                        className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-slate-800 outline-none transition-all"
                                    >
                                        <option value="all">Todas as acomodações</option>
                                        {roomTypes.map(room => (
                                            <option key={room.id} value={room.id}>{room.name}</option>
                                        ))}
                                    </select>
                                    <Home className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Período</label>
                                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 h-[46px]">
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="bg-transparent border-none text-xs font-bold text-slate-700 focus:ring-0 flex-1 p-0 cursor-pointer"
                                    />
                                    <ChevronRight className="h-3 w-3 text-slate-300 shrink-0" />
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="bg-transparent border-none text-xs font-bold text-slate-700 focus:ring-0 flex-1 p-0 cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Dias da Semana</label>
                            <div className="flex flex-wrap gap-2">
                                {WEEKDAYS.map(wd => (
                                    <button
                                        key={wd.day}
                                        onClick={() => toggleWeekday(wd.day)}
                                        className={cn(
                                            "flex-1 min-w-[45px] py-2 rounded-xl text-xs font-bold transition-all border",
                                            weekdays[wd.day] 
                                                ? "bg-slate-800 border-slate-800 text-white shadow-md shadow-slate-200" 
                                                : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                                        )}
                                    >
                                        {wd.label.substring(0, 3)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>

                    <div className="h-px bg-slate-100" />

                    {/* BLOCO 2 - AÇÕES */}
                    <section className="space-y-8">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="border-slate-200 text-slate-400 font-black text-[10px] px-2 py-0.5 rounded-md uppercase">02</Badge>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Ações Diretas</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* PREÇO */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-slate-400">
                                    <DollarSign className="h-4 w-4" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Preço e Estadia</span>
                                </div>
                                <div className="space-y-3">
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm transition-colors group-focus-within:text-slate-800">R$</div>
                                        <input
                                            type="number"
                                            placeholder="Não alterar"
                                            value={price}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value);
                                                if (isNaN(val)) setPrice('');
                                                else {
                                                    setPrice(val.toString());
                                                    e.target.value = val.toString();
                                                }
                                            }}
                                            onFocus={(e) => e.target.select()}
                                            className="w-full bg-white border border-slate-200 rounded-2xl pl-10 pr-4 py-4 text-sm font-black text-slate-800 placeholder:text-slate-300 placeholder:font-bold focus:ring-4 focus:ring-slate-100 focus:border-slate-800 outline-none transition-all shadow-sm"
                                        />
                                    </div>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px] uppercase tracking-widest transition-colors group-focus-within:text-slate-800">Min. Noites</div>
                                        <input
                                            type="number"
                                            placeholder="Não alterar"
                                            value={minLos}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value);
                                                if (isNaN(val)) setMinLos('');
                                                else {
                                                    setMinLos(val.toString());
                                                    e.target.value = val.toString();
                                                }
                                            }}
                                            onFocus={(e) => e.target.select()}
                                            className="w-full bg-white border border-slate-200 rounded-2xl pl-24 pr-4 py-4 text-sm font-black text-slate-800 placeholder:text-slate-300 placeholder:font-bold focus:ring-4 focus:ring-slate-100 focus:border-slate-800 outline-none transition-all shadow-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* INVENTÁRIO */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-slate-400">
                                    <Package className="h-4 w-4" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Disponibilidade</span>
                                </div>
                                <div className="space-y-4">
                                    {/* STD */}
                                    <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-slate-700">STANDARD</span>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Inventário Total</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button 
                                                onClick={() => setInventoryStd(prev => Math.max(0, (parseInt(prev) || 0) - 1).toString())}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors shadow-sm font-bold"
                                            >-</button>
                                            <input 
                                                type="number"
                                                placeholder="—"
                                                value={inventoryStd}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value);
                                                    if (isNaN(val)) setInventoryStd('');
                                                    else {
                                                        setInventoryStd(val.toString());
                                                        e.target.value = val.toString();
                                                    }
                                                }}
                                                onFocus={(e) => e.target.select()}
                                                className="w-12 text-center bg-transparent border-none text-sm font-black text-slate-800 focus:ring-0"
                                            />
                                            <button 
                                                onClick={() => setInventoryStd(prev => ((parseInt(prev) || 0) + 1).toString())}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors shadow-sm font-bold"
                                            >+</button>
                                        </div>
                                    </div>

                                    {/* 4P */}
                                    <div className={cn(
                                        "flex items-center justify-between p-4 rounded-2xl border transition-all",
                                        has4P ? "bg-slate-50 border-slate-100" : "bg-slate-50/50 border-dashed border-slate-200 opacity-60"
                                    )}>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs font-black text-slate-700">QUADRUPLO</span>
                                                <Users className="h-3 w-3 text-slate-400" />
                                            </div>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Acomodação 4P</span>
                                        </div>
                                        {has4P ? (
                                            <div className="flex items-center gap-1">
                                                <button 
                                                    onClick={() => setInventory4P(prev => Math.max(0, (parseInt(prev) || 0) - 1).toString())}
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors shadow-sm font-bold"
                                                >-</button>
                                                <input 
                                                    type="number"
                                                    placeholder="—"
                                                    value={inventory4P}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value);
                                                        if (isNaN(val)) setInventory4P('');
                                                        else {
                                                            setInventory4P(val.toString());
                                                            e.target.value = val.toString();
                                                        }
                                                    }}
                                                    onFocus={(e) => e.target.select()}
                                                    className="w-12 text-center bg-transparent border-none text-sm font-black text-slate-800 focus:ring-0"
                                                />
                                                <button 
                                                    onClick={() => setInventory4P(prev => ((parseInt(prev) || 0) + 1).toString())}
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors shadow-sm font-bold"
                                                >+</button>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] font-black text-slate-300 pr-2">N/A</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RESTRIÇÕES */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-slate-400">
                                <Activity className="h-4 w-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Restrições e Status</span>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <button
                                    onClick={() => toggleTriState(stopSell, setStopSell)}
                                    className={cn(
                                        "flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 transition-all group",
                                        stopSell === null ? "bg-white border-slate-100 text-slate-400 hover:border-slate-200" :
                                        stopSell === true ? "bg-red-50 border-red-500 text-red-600 shadow-lg shadow-red-100" :
                                        "bg-emerald-50 border-emerald-500 text-emerald-600 shadow-lg shadow-emerald-100"
                                    )}
                                >
                                    <span className="text-[10px] font-black uppercase tracking-widest">Stop Sell</span>
                                    {stopSell === null ? <Badge variant="outline" className="border-slate-200 text-slate-300">MANTER ATUAL</Badge> : 
                                     stopSell ? <Badge className="bg-red-500 hover:bg-red-600">BLOQUEADO</Badge> : 
                                     <Badge className="bg-emerald-500 hover:bg-emerald-600">ATIVO</Badge>}
                                </button>

                                <button
                                    onClick={() => toggleTriState(cta, setCta)}
                                    className={cn(
                                        "flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 transition-all group",
                                        cta === null ? "bg-white border-slate-100 text-slate-400 hover:border-slate-200" :
                                        cta === true ? "bg-red-50 border-red-500 text-red-600 shadow-lg shadow-red-100" :
                                        "bg-emerald-50 border-emerald-500 text-emerald-600 shadow-lg shadow-emerald-100"
                                    )}
                                >
                                    <span className="text-[10px] font-black uppercase tracking-widest">CTA</span>
                                    {cta === null ? <Badge variant="outline" className="border-slate-200 text-slate-300">MANTER ATUAL</Badge> : 
                                     cta ? <Badge className="bg-red-500 hover:bg-red-600">BLOQUEADO</Badge> : 
                                     <Badge className="bg-emerald-500 hover:bg-emerald-600">ATIVO</Badge>}
                                </button>

                                <button
                                    onClick={() => toggleTriState(ctd, setCtd)}
                                    className={cn(
                                        "flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 transition-all group",
                                        ctd === null ? "bg-white border-slate-100 text-slate-400 hover:border-slate-200" :
                                        ctd === true ? "bg-red-50 border-red-500 text-red-600 shadow-lg shadow-red-100" :
                                        "bg-emerald-50 border-emerald-500 text-emerald-600 shadow-lg shadow-emerald-100"
                                    )}
                                >
                                    <span className="text-[10px] font-black uppercase tracking-widest">CTD</span>
                                    {ctd === null ? <Badge variant="outline" className="border-slate-200 text-slate-300">MANTER ATUAL</Badge> : 
                                     ctd ? <Badge className="bg-red-500 hover:bg-red-600">BLOQUEADO</Badge> : 
                                     <Badge className="bg-emerald-500 hover:bg-emerald-600">ATIVO</Badge>}
                                </button>
                            </div>
                            <p className="text-[9px] font-bold text-slate-400 text-center uppercase tracking-widest flex items-center justify-center gap-1.5">
                                <Info className="h-3 w-3" />
                                Clique para alternar entre Bloquear, Ativar e Não Alterar
                            </p>
                        </div>
                    </section>
                </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex flex-col gap-4">
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-slate-400">
                    <span>Resumo de impacto</span>
                    <span className={cn(hasChanges ? "text-slate-800" : "text-slate-300")}>
                        {hasChanges ? (
                            <>Serão atualizados {affectedDays} {affectedDays === 1 ? 'dia' : 'dias'}</>
                        ) : "Nenhuma alteração detectada"}
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    <Button 
                        variant="ghost" 
                        onClick={onCancel}
                        className="flex-1 rounded-2xl py-6 font-bold text-slate-500 hover:text-slate-800"
                    >
                        Cancelar
                    </Button>
                    <Button 
                        disabled={!hasChanges || !startDate || !endDate || isSaving}
                        onClick={handleApply}
                        className={cn(
                            "flex-[2] rounded-2xl py-6 font-black text-sm transition-all shadow-xl",
                            hasChanges 
                                ? "bg-slate-800 hover:bg-slate-900 text-white shadow-slate-200" 
                                : "bg-slate-100 text-slate-300 shadow-none cursor-not-allowed"
                        )}
                    >
                        {isSaving ? "Aplicando..." : "Aplicar alterações em lote"}
                    </Button>
                </div>
            </div>
        </div>
    );
};
