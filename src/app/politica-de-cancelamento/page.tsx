import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
    title: "Política de cancelamento | Pousada Delplata",
    description:
        "Consulte as regras de cancelamento, alteração de datas e no-show aplicáveis às reservas da Pousada Delplata.",
    path: "/politica-de-cancelamento",
});

export default function PoliticaDeCancelamentoPage() {
    return (
        <main className="min-h-screen bg-muted/30 pt-28 pb-16">
            <div className="container mx-auto max-w-4xl px-4">
                <div className="rounded-xl border border-border/60 bg-white p-6 md:p-8 shadow-sm">
                    <h1 className="font-hero-display text-2xl font-semibold text-primary md:text-3xl">Política de Cancelamento</h1>
                    <p className="mt-2 text-sm text-muted-foreground">Última atualização: 15/07/2026</p>

                    <div className="mt-6 space-y-5 text-sm leading-6 text-foreground">
                        <section>
                            <h2 className="font-hero-display font-semibold">Condições aplicáveis à reserva</h2>
                            <p>
                                Os prazos, eventuais cobranças e condições de alteração, cancelamento ou reembolso precisam
                                ser confirmados com a Pousada Delplata antes da conclusão da reserva.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-hero-display font-semibold">Por que não há uma regra única publicada?</h2>
                            <p>
                                Esta página não anuncia prazos, percentuais, multas ou condições de no-show sem uma política
                                comercial formalmente validada pela administração da pousada.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-hero-display font-semibold">Como solicitar confirmação</h2>
                            <p>
                                Antes de pagar, solicite as condições aplicáveis às suas datas pelo e-mail{' '}
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
