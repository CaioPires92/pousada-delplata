import { ArrowUpRight } from "lucide-react";

import homeStyles from "@/components/home-novo/home-novo.module.css";
import { AGENDA_ITEMS, AGENDA_NOTES, AGENDA_SOURCES, AGENDA_UPDATED_AT, type AgendaItem } from "@/data/agenda-serra-negra";
import { getBrazilDateKey } from "@/lib/blog";

const dayFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", timeZone: "UTC" });
const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });
const fullFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });

function parts(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return {
    day: dayFormatter.format(parsed),
    month: monthFormatter.format(parsed).replace(".", "").toUpperCase(),
  };
}

export function getUpcomingAgenda(today = getBrazilDateKey(), limit = 6, items: AgendaItem[] = AGENDA_ITEMS) {
  return items
    .filter((item) => item.date >= today)
    .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id))
    .slice(0, limit);
}

// Agenda de Serra Negra: próximos eventos com a fonte de cada um. Eventos passados saem sozinhos.
export function BlogAgenda() {
  const upcoming = getUpcomingAgenda();
  if (upcoming.length === 0 && AGENDA_NOTES.length === 0) return null;

  return (
    <section aria-labelledby="agenda-title" className="bg-[color:var(--brand-forest)] py-12 text-white md:py-16">
      <div className="container grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        <div>
          <p className={`${homeStyles.eyebrow} text-[color:var(--brand-gold)]`}>Agenda de Serra Negra</p>
          <h2 id="agenda-title" className={`${homeStyles.display} mt-4 text-[clamp(2rem,4.4vw,3.6rem)]`}>
            O que vem <em>por aí</em>
          </h2>
          <p className="mt-5 max-w-[44ch] text-base leading-7 text-white/80">
            Natal Luzes da Serra, paradas e shows de fim de ano, reunidos das fontes oficiais. Datas e horários podem mudar: confira na
            fonte antes de ir.
          </p>
          <p className="mt-4 text-sm text-white/60">Atualizada em {fullFormatter.format(new Date(`${AGENDA_UPDATED_AT}T00:00:00.000Z`))}.</p>
          <ul className="mt-5 space-y-2 text-sm">
            {AGENDA_SOURCES.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-semibold text-[color:var(--brand-gold)] underline underline-offset-4 hover:text-white"
                >
                  {source.name} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <ol className="border-t border-white/15">
          {upcoming.map((item) => {
            const { day, month } = parts(item.date);
            return (
              <li key={item.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-4 border-b border-white/15 py-4 md:grid-cols-[5.5rem_minmax(0,1fr)] md:gap-6">
                <div className="text-center">
                  <p className={`${homeStyles.display} text-[2.2rem] text-[color:var(--brand-gold)]`}>{day}</p>
                  <p className="mt-1 text-xs font-bold tracking-[0.16em] text-white/75">{month}</p>
                </div>
                <div>
                  <p className="text-lg font-semibold leading-snug">{item.title}</p>
                  <p className="mt-1 text-sm text-white/75">
                    {[item.time, item.place].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-2 text-xs text-white/60">
                    Fonte:{" "}
                    <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white">
                      {item.sourceName}
                    </a>
                    {item.confirm ? <span className="ml-2 border border-white/30 px-1.5 py-0.5 text-[0.65rem] uppercase tracking-[0.1em]">confirmar data</span> : null}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        {AGENDA_NOTES.length > 0 ? (
          <div className="lg:col-span-2">
            {AGENDA_NOTES.map((note) => (
              <p key={note.id} className="border border-white/20 px-4 py-3 text-sm leading-6 text-white/85">
                {note.text}{" "}
                <a href={note.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[color:var(--brand-gold)] underline underline-offset-4 hover:text-white">
                  {note.sourceName}
                </a>
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
