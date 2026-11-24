// Agenda de Serra Negra mostrada no blog.
//
// REGRAS (valem para quem atualizar, inclusive a rotina semanal):
// - Só entra evento que tenha uma fonte pública com link (`sourceUrl`). Nada de data "de cabeça".
// - Se a fonte for a imprensa e não a Prefeitura, deixe `confirm: true` para o site avisar o visitante.
// - Não copie textos das fontes: escreva o dado (o quê, quando, onde) e aponte o link.
// - Eventos passados somem sozinhos da tela; podem ser apagados daqui a cada atualização.

export type AgendaItem = {
  id: string;
  title: string;
  /** Data (AAAA-MM-DD). */
  date: string;
  /** Horário livre, ex.: "20h" ou "19h e 21h". */
  time?: string;
  place?: string;
  /** Marca o item como "a confirmar": a fonte é a imprensa, não a Prefeitura. */
  confirm?: boolean;
  sourceName: string;
  sourceUrl: string;
};

export const AGENDA_UPDATED_AT = "2026-11-24";

export const AGENDA_SOURCES = [
  { name: "Visite Serra Negra: agenda de eventos", url: "https://visiteserranegra.com.br/agenda-de-eventos/" },
  { name: "Prefeitura de Serra Negra", url: "https://www.serranegra.sp.gov.br/" },
] as const;

const DIARIO = {
  sourceName: "Diário do Turismo",
  sourceUrl: "https://diariodoturismo.com.br/natal-em-serra-negra-comeca-em-novembro-com-2-milhoes-de-luzes-e-desfiles/",
};

const parada = (date: string): AgendaItem => ({
  id: `parada-natal-${date}`,
  title: "Parada de Natal",
  date,
  time: "20h",
  place: "Centro, pela Rua Coronel Pedro Penteado",
  confirm: true,
  ...DIARIO,
});

export const AGENDA_ITEMS: AgendaItem[] = [
  {
    id: "abertura-natal-2026",
    title: "Abertura do Natal Luzes da Serra: chegada do Papai Noel e acendimento das luzes",
    date: "2026-11-13",
    time: "18h30",
    place: "Praça John Fitzgerald Kennedy, em frente ao Palácio das Águas",
    sourceName: "Visite Serra Negra",
    sourceUrl: "https://visiteserranegra.com.br/agenda-de-eventos/",
  },
  {
    id: "sarau-talento-2026-11-26",
    title: "Sarau da Escola Talento Oficina de Artes",
    date: "2026-11-26",
    time: "20h",
    place: "Praça Prefeito João Zelante",
    sourceName: "Visite Serra Negra",
    sourceUrl: "https://visiteserranegra.com.br/eventos/natal-luzes-da-serra-2026-8/",
  },
  {
    id: "guri-virtude-2026-11-27",
    title: "Projeto Guri e Banda Virtude Zero",
    date: "2026-11-27",
    time: "19h e 21h",
    place: "Praça Prefeito João Zelante",
    sourceName: "Visite Serra Negra",
    sourceUrl: "https://visiteserranegra.com.br/eventos/natal-luzes-da-serra-2026-9/",
  },
  {
    id: "jazz-mpb-2026-11-28",
    title: "Daniela Cagnoni e Ivan Cruz (jazz e MPB)",
    date: "2026-11-28",
    time: "15h30",
    place: "Praça Barão do Rio Branco",
    sourceName: "Visite Serra Negra",
    sourceUrl: "https://visiteserranegra.com.br/eventos/natal-luzes-da-serra-2026-42/",
  },
  {
    id: "cantata-libere-2026-12-04",
    title: "Cantata de Natal do Colégio Libere Vivere e Banda Dona Rute",
    date: "2026-12-04",
    time: "18h e 20h",
    place: "Praça Prefeito João Zelante",
    sourceName: "Visite Serra Negra",
    sourceUrl: "https://visiteserranegra.com.br/eventos/natal-luzes-da-serra-2026-12/",
  },
  {
    id: "concerto-natalino-2026-12-05",
    title: "Concerto Popular Natalino",
    date: "2026-12-05",
    time: "19h",
    place: "Fontana di Trevi",
    sourceName: "Visite Serra Negra",
    sourceUrl: "https://visiteserranegra.com.br/eventos/natal-luzes-da-serra-2026-37/",
  },
  {
    id: "cantata-natal-2026-12-11",
    title: "Cantata de Natal",
    date: "2026-12-11",
    time: "20h30",
    place: "Praça Prefeito João Zelante",
    sourceName: "Visite Serra Negra",
    sourceUrl: "https://visiteserranegra.com.br/eventos/natal-luzes-da-serra-2026-17/",
  },
  parada("2026-12-12"),
  parada("2026-12-17"),
  parada("2026-12-19"),
  parada("2026-12-23"),
  parada("2026-12-25"),
  parada("2026-12-27"),
];
