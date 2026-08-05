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

export default function AdminInboxPage() {
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
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
    void loadConversations({ initial: true });

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
