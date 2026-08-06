"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { LockKeyhole, StickyNote, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type InternalNote = {
    id: string;
    authorId: string | null;
    content: string;
    createdAt: string;
    updatedAt: string;
};

type InternalNotesPanelProps = {
    conversationId: string;
};

function noteTime(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(date);
}

export default function InternalNotesPanel({ conversationId }: InternalNotesPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [notes, setNotes] = useState<InternalNote[]>([]);
    const [content, setContent] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        const controller = new AbortController();

        async function loadNotes() {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch(`/api/crm/conversations/${conversationId}/notes`, {
                    cache: "no-store",
                    signal: controller.signal,
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || "Falha ao carregar notas");
                setNotes(Array.isArray(data.notes) ? data.notes : []);
            } catch (loadError) {
                if (!controller.signal.aborted) {
                    setError(loadError instanceof Error ? loadError.message : "Falha ao carregar notas");
                }
            } finally {
                if (!controller.signal.aborted) setIsLoading(false);
            }
        }

        void loadNotes();
        return () => controller.abort();
    }, [conversationId, isOpen]);

    async function createNote(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const noteContent = content.trim();
        if (!noteContent || isSaving) return;

        setIsSaving(true);
        setError(null);
        try {
            const response = await fetch(`/api/crm/conversations/${conversationId}/notes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: noteContent }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Falha ao salvar nota");
            setNotes(previous => [data.note as InternalNote, ...previous]);
            setContent("");
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : "Falha ao salvar nota");
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="mt-3 border-t border-slate-100 pt-3">
            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={() => setIsOpen(open => !open)}
                    aria-expanded={isOpen}
                    aria-controls="internal-notes-panel"
                    className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                    {isOpen ? <X aria-hidden="true" className="h-4 w-4" /> : <StickyNote aria-hidden="true" className="h-4 w-4" />}
                    {isOpen ? "Fechar notas" : `Notas internas${notes.length > 0 ? ` (${notes.length})` : ""}`}
                </button>
            </div>

            {isOpen && (
                <section
                    id="internal-notes-panel"
                    aria-label="Notas internas da conversa"
                    className="mt-3 grid gap-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.75fr)]"
                >
                    <form onSubmit={createNote} className="space-y-3">
                        <div>
                            <h2 className="text-sm font-black text-slate-900">Registrar nota interna</h2>
                            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                                <LockKeyhole aria-hidden="true" className="h-3.5 w-3.5" />
                                Visível apenas para a equipe. Não é enviada ao hóspede.
                            </p>
                        </div>
                        <Textarea
                            value={content}
                            onChange={event => setContent(event.target.value)}
                            maxLength={2_000}
                            placeholder="Escreva uma observação sobre este atendimento..."
                            className="min-h-24 resize-y border-amber-200 bg-white focus:border-amber-500 focus:ring-amber-500"
                            disabled={isSaving}
                        />
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-[11px] font-semibold text-slate-500">{content.length}/2000</span>
                            <Button
                                type="submit"
                                disabled={isSaving || !content.trim()}
                                className="bg-amber-700 font-black hover:bg-amber-800"
                            >
                                {isSaving ? "Salvando..." : "Adicionar nota"}
                            </Button>
                        </div>
                        {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
                    </form>

                    <div className="max-h-52 space-y-2 overflow-y-auto" aria-live="polite">
                        {isLoading ? (
                            <p className="text-sm font-semibold text-slate-500">Carregando notas...</p>
                        ) : notes.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-amber-200 bg-white/70 p-3 text-sm text-slate-500">
                                Nenhuma nota interna registrada.
                            </p>
                        ) : notes.map(note => (
                            <article key={note.id} className="rounded-lg border border-amber-100 bg-white p-3 shadow-sm">
                                <p className="whitespace-pre-wrap break-words text-sm text-slate-800">{note.content}</p>
                                <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                    {noteTime(note.createdAt)}
                                </p>
                            </article>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
