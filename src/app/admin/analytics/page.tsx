'use client';

import { useEffect, useState } from 'react';
import { 
  BarChart3, 
  Users, 
  TrendingUp, 
  DollarSign, 
  MessageSquare, 
  MousePointer2,
  ArrowUpRight,
  Loader2,
  PieChart as PieChartIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Stats = {
  totalLeads: number;
  byStage: { stage: string; count: number }[];
  bySource: { source: string; count: number }[];
  activeValue: number;
  closedValue: number;
  avgResponseTime: number;
  conversionRate: number;
};

const STAGE_LABELS: Record<string, string> = {
  novo: "Novo",
  em_atendimento: "Em atendimento",
  proposta: "Proposta",
  fechado: "Fechado",
  perdido: "Perdido",
};

export default function CRMAnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const gridCols = "grid gap-6 md:grid-cols-2 lg:grid-cols-5";

  async function loadStats() {
    try {
      const res = await fetch('/api/crm/stats', { cache: 'no-store' });
      const data = await res.json();
      if (data.ok) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error("Erro ao carregar estatísticas:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadStats();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="animate-spin text-emerald-600" size={32} />
      </div>
    );
  }

  if (!stats) return null;

  function formatSLA(minutes: number): string {
    if (minutes < 1) return "Sub-minuto";
    if (minutes < 60) return `${minutes.toFixed(0)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${hours}h ${mins}m`;
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Analytics & Insights</p>
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter mt-1">Performance Comercial</h1>
      </header>

      {/* Grid de Cards Principais */}
      <div className={gridCols}>
        <StatCard 
          label="Total de Leads" 
          value={stats.totalLeads.toString()} 
          icon={Users} 
          color="blue"
        />
        <StatCard 
          label="Taxa de Conversão" 
          value={`${stats.conversionRate.toFixed(1)}%`} 
          icon={TrendingUp} 
          color="emerald"
        />
        <StatCard 
          label="Pipeline Ativa" 
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.activeValue)} 
          icon={DollarSign} 
          color="amber"
        />
        <StatCard 
          label="Valor Convertido" 
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.closedValue)} 
          icon={ArrowUpRight} 
          color="purple"
        />
        <StatCard 
          label="Tempo de Resposta (Média)" 
          value={formatSLA(stats.avgResponseTime)} 
          icon={MessageSquare} 
          color="blue"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Distribuição por Estágio */}
        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <BarChart3 className="text-emerald-600" size={20} />
              Funil de Vendas
            </h2>
          </div>
          <div className="space-y-6">
            {stats.byStage.map(s => (
              <div key={s.stage}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-slate-600">{STAGE_LABELS[s.stage] || s.stage}</span>
                  <span className="text-sm font-black text-slate-900">{s.count}</span>
                </div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-1000",
                      s.stage === 'fechado' ? 'bg-emerald-500' : s.stage === 'perdido' ? 'bg-red-400' : 'bg-slate-800'
                    )}
                    style={{ width: `${(s.count / stats.totalLeads) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Origem dos Leads */}
        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <PieChartIcon className="text-emerald-600" size={20} />
              Origem dos Leads
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {stats.bySource.map(s => (
              <div key={s.source} className="p-6 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center text-center">
                <div className="p-3 rounded-xl bg-white shadow-sm mb-3">
                  {s.source === 'whatsapp' ? <MessageSquare className="text-emerald-600" /> : <MousePointer2 className="text-blue-600" />}
                </div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{s.source}</span>
                <span className="text-2xl font-black text-slate-900 mt-1">{s.count}</span>
                <span className="text-xs font-bold text-slate-500 mt-1">{((s.count / stats.totalLeads) * 100).toFixed(0)}% do total</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string, value: string, icon: any, color: 'blue' | 'emerald' | 'amber' | 'purple' }) {
  const colors = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
  };

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all">
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center border mb-4", colors[color])}>
        <Icon size={24} />
      </div>
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-2xl font-black text-slate-900 mt-1 tracking-tight">{value}</p>
    </article>
  );
}
