"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import {
  mergeConversationItems,
  parseConversationPage,
  type ConversationListItem,
} from "@/lib/crm/inboxPagination";

const PAGE_SIZE = 20;

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Sem atividade";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Sem atividade";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
}

function formatDuration(totalSeconds: number | null): string {
  if (totalSeconds === null || !Number.isFinite(totalSeconds)) return "—";
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
}

function elapsedSeconds(value: string | null): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : Math.max(0, (Date.now() - timestamp) / 1_000);
}

export default function AdminInboxPage() {
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [metrics, setMetrics] = useState({
    awaitingHumanCount: 0,
    oldestWaitingSince: null as string | null,
    averageFirstResponseSeconds: null as number | null,
  });
  const [pageInfo, setPageInfo] = useState<{ hasMore: boolean; nextCursor: string | null }>({
    hasMore: false,
    nextCursor: null,
  });
  const mountedRef = useRef(false);
  const loadedCountRef = useRef(0);

  const loadConversations = useCallback(async (options?: {
    append?: boolean;
    cursor?: string;
    initial?: boolean;
  }) => {
    const append = options?.append === true;
    const hadAdditionalPages = loadedCountRef.current > PAGE_SIZE;
    if (append) setLoadingMore(true);

    try {
      const searchParams = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (options?.cursor) searchParams.set("cursor", options.cursor);

      const response = await fetch(`/api/crm/conversations?${searchParams}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Falha ao carregar conversas");

      const page = parseConversationPage(await response.json());
      if (!page) throw new Error("Resposta inválida da Inbox");
      if (!mountedRef.current) return;
      setMetrics(page.metrics);

      setConversations(current => {
        const next = append || hadAdditionalPages
          ? mergeConversationItems(current, page.items)
          : page.items;
        loadedCountRef.current = next.length;
        return next;
      });

      if (append || options?.initial || !hadAdditionalPages) {
        setPageInfo(page.pageInfo);
      }
    } catch (error) {
      console.error("Erro ao carregar inbox do CRM:", error);
      if (mountedRef.current && options?.initial) {
        setConversations([]);
        loadedCountRef.current = 0;
      }
    } finally {
      if (mountedRef.current) {
        if (options?.initial) setLoading(false);
        if (append) setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const initialLoadId = window.setTimeout(() => {
      void loadConversations({ initial: true });
    }, 0);

    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadConversations();
      }
    }, 3000);
    const refreshOnFocus = () => void loadConversations();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadConversations();
    };
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(initialLoadId);
      clearInterval(intervalId);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadConversations]);

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600">
            CRM Delplata
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">Inbox WhatsApp</h1>
          <p className="mt-2 text-sm text-slate-500">
            Conversas recentes recebidas pelo webhook da Evolution API.
          </p>
        </header>

        <section aria-label="Indicadores de atendimento" className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Aguardando humano</p>
            <p className="mt-2 text-2xl font-black text-amber-950">{metrics.awaitingHumanCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Maior espera atual</p>
            <p className="mt-2 text-2xl font-black text-slate-900">
              {formatDuration(elapsedSeconds(metrics.oldestWaitingSince))}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Média da 1ª resposta</p>
            <p className="mt-2 text-2xl font-black text-slate-900">
              {formatDuration(metrics.averageFirstResponseSeconds)}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="px-6 py-10 text-sm text-slate-500">Carregando conversas...</div>
          ) : conversations.length === 0 ? (
            <div className="px-6 py-10 text-sm text-slate-500">Nenhuma conversa encontrada</div>
          ) : (
            <>
              <ul className="divide-y divide-slate-200">
                {conversations.map((conversation) => (
                  <li key={conversation.id}>
                    <Link
                      href={`/admin/inbox/${conversation.id}`}
                      className="block px-6 py-5 transition-colors hover:bg-slate-50"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h2 className="truncate text-base font-semibold text-slate-900">
                              {conversation.name}
                            </h2>
                            {conversation.presence?.isOnline ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                Online
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-slate-500">
                            {conversation.phone ?? (conversation.lid ? `ID: ${conversation.lid}` : "Telefone não informado")}
                          </p>
                          <p className="mt-3 text-sm text-slate-700">
                            {conversation.lastMessage ?? "Sem mensagem visível"}
                          </p>
                          {conversation.waitingSince ? (
                            <span className="mt-3 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-800">
                              Aguardando há {formatDuration(elapsedSeconds(conversation.waitingSince))}
                            </span>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-2 text-sm text-slate-500">
                          {formatDateTime(conversation.lastMessageAt)}
                          {conversation.unreadCount > 0 ? (
                            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
                              {conversation.unreadCount}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              {pageInfo.hasMore && pageInfo.nextCursor ? (
                <div className="border-t border-slate-200 px-6 py-4 text-center">
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={() => void loadConversations({
                      append: true,
                      cursor: pageInfo.nextCursor ?? undefined,
                    })}
                    className="rounded-full border border-emerald-600 px-5 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loadingMore ? "Carregando..." : "Carregar mais conversas"}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
