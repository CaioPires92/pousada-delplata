'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type ConversationListItem = {
  id: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  name: string;
  phone: string | null;
  lid: string | null;
  unreadCount: number;
};

function formatDateTime(value: string | null): string {
  if (!value) {
    return 'Sem atividade';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Sem atividade';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed);
}

export default function AdminInboxPage() {
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadConversations() {
      try {
        const response = await fetch('/api/crm/conversations', {
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error('Falha ao carregar conversas');
        }

        const data: unknown = await response.json();
        if (!active || !Array.isArray(data)) {
          return;
        }

        const normalizedData = data
          .map((item): ConversationListItem | null => {
            if (!item || typeof item !== 'object') {
              return null;
            }

            const record = item as Record<string, unknown>;
            if (typeof record.id !== 'string' || typeof record.name !== 'string') {
              return null;
            }

            return {
              id: record.id,
              lastMessage: typeof record.lastMessage === 'string' ? record.lastMessage : null,
              lastMessageAt: typeof record.lastMessageAt === 'string' ? record.lastMessageAt : null,
              name: record.name,
              phone: typeof record.phone === 'string' ? record.phone : null,
              lid: typeof record.lid === 'string' ? record.lid : null,
              unreadCount: typeof record.unreadCount === 'number' ? record.unreadCount : 0,
            };
          })
          .filter((item): item is ConversationListItem => item !== null);

        setConversations(normalizedData);
      } catch (error) {
        console.error('Erro ao carregar inbox do CRM:', error);
        if (active) {
          setConversations([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadConversations();

    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadConversations();
      }
    }, 3000);
    window.addEventListener('focus', loadConversations);
    document.addEventListener('visibilitychange', loadConversations);

    return () => {
      active = false;
      clearInterval(intervalId);
      window.removeEventListener('focus', loadConversations);
      document.removeEventListener('visibilitychange', loadConversations);
    };
  }, []);

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
            <ul className="divide-y divide-slate-200">
              {conversations.map((conversation) => (
                <li key={conversation.id}>
                  <Link 
                    href={`/admin/inbox/${conversation.id}`}
                    className="block px-6 py-5 transition-colors hover:bg-slate-50"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-semibold text-slate-900">
                          {conversation.name}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                          {conversation.phone ?? (conversation.lid ? `ID: ${conversation.lid}` : 'Telefone não informado')}
                        </p>
                        <p className="mt-3 text-sm text-slate-700">
                          {conversation.lastMessage ?? 'Sem mensagem visível'}
                        </p>
                      </div>

                      <div className="shrink-0 flex flex-col items-end gap-2 text-sm text-slate-500">
                        {formatDateTime(conversation.lastMessageAt)}
                        {conversation.unreadCount > 0 && (
                          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
                            {conversation.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
