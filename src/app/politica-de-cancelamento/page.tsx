import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
    title: "Política de cancelamento | Pousada Delplata",
    description:
        "Consulte as regras de cancelamento, estorno, crédito, saída antecipada e no-show das reservas da Pousada Delplata.",
    path: "/politica-de-cancelamento",
});

const CANCELLATION_RULES = [
    'Em caso de saída antecipada das diárias contratadas, não haverá devolução do valor pago antecipadamente e não será gerado nenhum crédito.',
    'Aviso de cancelamento acima de 14 dias de antecedência da entrada no hotel (check-in): há estorno de 100% do valor pago, ou geramos um crédito que pode ser utilizado em outra data dentro do prazo de 3 meses.',
    'Aviso de cancelamento com mais de 7 dias de antecedência da entrada no hotel (check-in): há estorno de 50% do valor pago, ou geramos um crédito que pode ser utilizado em outra data dentro do prazo de 3 meses.',
    'Aviso de cancelamento com menos de 7 dias da entrada no hotel (check-in): não há estorno nem crédito.',
    'Aviso de cancelamento com menos de 24 horas ou no-show (não comparecimento no dia da chegada): não há estorno e não há direito a crédito.',
    'Como nosso tarifário muda sazonalmente e em feriados, o crédito é em valor e não em número de diárias.',
] as const;

export default function PoliticaDeCancelamentoPage() {
    return (
        <main className="min-h-screen bg-muted/30 pt-28 pb-16">
            <div className="container mx-auto max-w-4xl px-4">
                <div className="rounded-xl border border-border/60 bg-white p-6 md:p-8 shadow-sm">
                    <h1 className="font-hero-display text-2xl font-semibold text-primary md:text-3xl">Política de Cancelamento</h1>
                    <p className="mt-2 text-sm text-muted-foreground">Última atualização: 25/11/2026</p>

                    <div className="mt-6 space-y-5 text-sm leading-6 text-foreground">
                        <section>
                            <p>
                                A política de cancelamento instruída pela EMBRATUR conforme Deliberação Normativa nº 165/95
                                procede-se da seguinte forma:
                            </p>
                            <ul className="mt-3 list-disc space-y-2 pl-5">
                                {CANCELLATION_RULES.map((rule) => (
                                    <li key={rule}>{rule}</li>
                                ))}
                            </ul>
                        </section>

                        <section>
                            <h2 className="font-hero-display font-semibold">Como solicitar o cancelamento</h2>
                            <p>
                                Para cancelar ou tirar dúvidas, fale com a pousada pelo e-mail{' '}
                                <a className="text-primary underline" href="mailto:contato@pousadadelplata.com.br">
                                    contato@pousadadelplata.com.br
                                </a>{' '}
                                ou WhatsApp (19) 99965-4866.
                            </p>
                        </section>
                    </div>
                </div>
            </div>
        </main>
    );
}
