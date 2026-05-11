'use client';

import { Bell, MessageSquare, PlusCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type Notification = {
  id: string;
  action: string;
  contactName: string;
  createdAt: string;
  metadata: any;
};

export default function AdminHeader() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hasNew, setHasNew] = useState(false);

  async function fetchNotifications() {
    try {
      const res = await fetch('/api/crm/notifications', { cache: 'no-store' });
      const data = await res.json();
      if (data.ok) {
        setNotifications(data.notifications);
        // Se a primeira notificação for muito recente (últimos 30s), marca como "novo"
        if (data.notifications.length > 0) {
          const firstDate = new Date(data.notifications[0].createdAt);
          const now = new Date();
          if (now.getTime() - firstDate.getTime() < 30000) {
            setHasNew(true);
          }
        }
      }
    } catch (err) {
      console.error("Erro ao carregar notificações:", err);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(fetchNotifications, 0);
    const interval = setInterval(fetchNotifications, 15000); // Poll a cada 15s
    return () => {
      window.clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="flex h-16 items-center justify-end px-8 border-b border-slate-200 bg-white sticky top-0 z-40">
      <div className="relative">
        <button 
          onClick={() => {
            setIsOpen(!isOpen);
            setHasNew(false);
          }}
          className={cn(
            "p-2 rounded-full transition-all relative",
            isOpen ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
          )}
        >
          <Bell size={20} />
          {hasNew && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
          )}
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white border border-slate-200 shadow-2xl animate-in slide-in-from-top-2">
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Atividade Recente</h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-400">Nenhuma atividade recente</div>
              ) : (
                notifications.map(notif => (
                  <div key={notif.id} className="p-4 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                    <div className="flex gap-3">
                      <div className={cn(
                        "p-2 rounded-lg shrink-0",
                        notif.action === 'LeadCreated' ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                      )}>
                        {notif.action === 'LeadCreated' ? <PlusCircle size={16} /> : <MessageSquare size={16} />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {notif.action === 'LeadCreated' ? "Novo Lead!" : "Nova Mensagem"}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {notif.contactName}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium">
                          {new Date(notif.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
