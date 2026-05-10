"use client";

import { useState, useEffect } from "react";
import { DollarSign, Calendar, StickyNote, Save, Plus, Trash2, Clock, Search, Link as LinkIcon, AlertCircle } from "lucide-react";

type InternalNote = {
    id: string;
    content: string;
    createdAt: string;
};

type PipelineCard = {
    id: string;
    estimatedValue: number | null;
    intendedArrival: string | null;
    stage: string;
    bookingId: string | null;
};

type BookingSearchRes = {
    id: string;
    checkIn: string;
    checkOut: string;
    status: string;
    roomType: { name: string };
};

interface SalesSidebarProps {
    conversationId: string;
    initialCard: PipelineCard | null;
}

export default function SalesSidebar({ conversationId, initialCard }: SalesSidebarProps) {
    const [card, setCard] = useState<PipelineCard | null>(initialCard);
    const [notes, setNotes] = useState<InternalNote[]>([]);
    const [newNote, setNewNote] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingNote, setIsSavingNote] = useState(false);
    const [uiError, setUiError] = useState<string | null>(null);

    // Busca de Reservas
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<BookingSearchRes[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const [editData, setEditData] = useState({
        estimatedValue: initialCard?.estimatedValue?.toString() || "",
        intendedArrival: initialCard?.intendedArrival ? new Date(initialCard.intendedArrival).toISOString().split('T')[0] : ""
    });

    useEffect(() => {
        fetchNotes();
        // Reset erro ao mudar de conversa
        setUiError(null);
    }, [conversationId]);

    async function fetchNotes() {
        try {
            const res = await fetch(`/api/crm/conversations/${conversationId}/notes`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            if (data.ok) setNotes(data.notes);
        } catch (err) {
            console.error("Falha ao carregar notas");
        }
    }

    async function handleUpdateCard(updates: any) {
        if (!card) return;
        setIsSaving(true);
        setUiError(null);
        try {
            const res = await fetch(`/api/crm/pipeline/${card.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates),
            });
            const data = await res.json();
            if (res.ok && data.ok) {
                setCard({ ...card, ...updates });
            } else {
                throw new Error(data.error || "Falha ao salvar");
            }
        } catch (err: any) {
            setUiError(err.message || "Erro de conexão ao atualizar card.");
        } finally {
            setIsSaving(false);
        }
    }

    async function handleSearchBookings() {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        setUiError(null);
        try {
            const res = await fetch(`/api/crm/bookings/search?q=${encodeURIComponent(searchQuery)}`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            if (data.ok) setSearchResults(data.bookings);
        } catch (err) {
            setUiError("Erro ao buscar reservas.");
        } finally {
            setIsSearching(false);
        }
    }

    async function handleAddNote(e: React.FormEvent) {
        e.preventDefault();
        if (!newNote.trim()) return;
        setIsSavingNote(true);
        setUiError(null);
        try {
            const res = await fetch(`/api/crm/conversations/${conversationId}/notes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: newNote }),
            });
            const data = await res.json();
            if (res.ok && data.ok) {
                setNotes([data.note, ...notes]);
                setNewNote("");
            } else {
                throw new Error(data.error || "Falha ao salvar nota");
            }
        } catch (err: any) {
            setUiError(err.message || "Erro ao salvar nota interna.");
        } finally {
            setIsSavingNote(false);
        }
    }

    return (
        <aside className="w-80 border-l border-slate-200 bg-slate-50 flex flex-col h-full overflow-hidden">
            {uiError && (
                <div className="bg-red-50 border-b border-red-100 p-3 flex items-center gap-2 text-red-700 text-[10px] font-black uppercase animate-in slide-in-from-top duration-300">
                    <AlertCircle size={14} />
                    {uiError}
                    <button onClick={() => setUiError(null)} className="ml-auto text-red-400">FECHAR</button>
                </div>
            )}

            {/* Oportunidade Section */}
            <div className="p-5 border-b border-slate-200 bg-white shadow-sm">
                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-4">
                    <DollarSign size={14} className="text-emerald-600" />
                    Oportunidade
                </h2>
                
                {card ? (
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Valor Estimado</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">R$</span>
                                <input
                                    disabled={isSaving}
                                    type="number"
                                    value={editData.estimatedValue}
                                    onChange={e => setEditData({ ...editData, estimatedValue: e.target.value })}
                                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border-2 border-slate-100 bg-slate-50 focus:border-emerald-500 focus:bg-white outline-none text-sm font-black transition-all disabled:opacity-50"
                                    placeholder="0,00"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Data Pretendida</label>
                            <input
                                disabled={isSaving}
                                type="date"
                                value={editData.intendedArrival}
                                onChange={e => setEditData({ ...editData, intendedArrival: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-100 bg-slate-50 focus:border-emerald-500 focus:bg-white outline-none text-sm font-bold transition-all disabled:opacity-50"
                            />
                        </div>

                        <button
                            onClick={() => handleUpdateCard({
                                estimatedValue: parseFloat(editData.estimatedValue) || null,
                                intendedArrival: editData.intendedArrival || null
                            })}
                            disabled={isSaving}
                            className="w-full bg-slate-900 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 disabled:opacity-50"
                        >
                            <Save size={14} />
                            {isSaving ? "PROCESSANDO..." : "ATUALIZAR DADOS"}
                        </button>
                    </div>
                ) : (
                    <p className="text-xs text-slate-400 italic font-medium">Contato sem card no pipeline.</p>
                )}
            </div>

            {/* Vínculo de Reserva Section */}
            <div className="p-5 border-b border-slate-200 bg-white">
                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-4">
                    <LinkIcon size={14} className="text-blue-500" />
                    Vincular Reserva
                </h2>

                {card?.bookingId ? (
                    <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black text-blue-600 uppercase">Reserva Vinculada</p>
                            <p className="text-sm font-bold text-blue-900">ID: {card.bookingId.slice(0, 8)}...</p>
                        </div>
                        <button 
                            disabled={isSaving}
                            onClick={() => handleUpdateCard({ bookingId: null })}
                            className="p-2 text-blue-400 hover:text-red-500 transition-all disabled:opacity-50"
                            title="Remover vínculo"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="relative">
                            <input
                                disabled={isSearching}
                                type="text"
                                placeholder="Buscar por nome ou ID..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearchBookings()}
                                className="w-full pl-3 pr-10 py-2 rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
                            />
                            <button 
                                disabled={isSearching}
                                onClick={handleSearchBookings}
                                className="absolute right-2 top-1.5 p-1 text-slate-400 hover:text-blue-500 disabled:opacity-50"
                            >
                                <Search size={16} />
                            </button>
                        </div>

                        {searchResults.length > 0 && (
                            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                {searchResults.map(b => (
                                    <div key={b.id} className="p-2 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-between group">
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-black text-slate-800 truncate">{b.roomType.name}</p>
                                            <p className="text-[9px] text-slate-500 font-bold">{new Date(b.checkIn).toLocaleDateString()} - {new Date(b.checkOut).toLocaleDateString()}</p>
                                        </div>
                                        <button
                                            disabled={isSaving}
                                            onClick={() => handleUpdateCard({ bookingId: b.id })}
                                            className="bg-white border border-slate-200 p-1 rounded hover:bg-blue-500 hover:text-white transition-all shadow-sm disabled:opacity-50"
                                            title="Vincular"
                                        >
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Notas Internas Section */}
            <div className="flex-1 overflow-auto p-5 space-y-4">
                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <StickyNote size={14} className="text-amber-500" />
                    Notas Internas
                </h2>

                <form onSubmit={handleAddNote} className="relative group">
                    <textarea
                        disabled={isSavingNote}
                        value={newNote}
                        onChange={e => setNewNote(e.target.value)}
                        placeholder="Anotação que o cliente não vê..."
                        className="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 bg-white focus:border-amber-400 outline-none text-xs font-medium min-h-[100px] resize-none pb-12 transition-all shadow-inner disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={isSavingNote || !newNote.trim()}
                        className="absolute right-3 bottom-3 bg-slate-900 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50 shadow-lg"
                    >
                        {isSavingNote ? "..." : "Adicionar"}
                    </button>
                </form>

                <div className="space-y-3">
                    {notes.map(note => (
                        <div key={note.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2 hover:border-amber-200 transition-all animate-in zoom-in-95">
                            <p className="text-xs text-slate-700 font-medium leading-relaxed">{note.content}</p>
                            <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-black uppercase tracking-widest">
                                <Clock size={10} />
                                {new Date(note.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                            </div>
                        </div>
                    ))}
                    {notes.length === 0 && (
                        <div className="py-8 text-center bg-slate-100/50 rounded-2xl border-2 border-dashed border-slate-200">
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Sem notas</p>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
}
