import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Política de Cancelamento | Pousada Delplata',
    description: 'Política de cancelamento e alteração de reservas da Pousada Delplata.',
};

export default function PoliticaDeCancelamentoPage() {
    return (
        <main className="min-h-screen bg-muted/30 pt-28 pb-16">
            <div className="container mx-auto max-w-4xl px-4">
                <div className="rounded-xl border border-border/60 bg-white p-6 md:p-8 shadow-sm">
                    <h1 className="text-2xl md:text-3xl font-bold text-primary">Política de Cancelamento</h1>
                    <p className="mt-2 text-sm text-muted-foreground">Última atualização: 12/02/2026</p>

                    <div className="mt-6 space-y-5 text-sm leading-6 text-foreground">
                        <section>
                            <h2 className="font-semibold">1. Cancelamento pelo hóspede</h2>
                            <p>
                                Solicitações de cancelamento devem ser feitas pelos canais oficiais da pousada. A análise de
                                reembolso considera a data da solicitação, regras da tarifa e condições informadas no ato da
                                reserva.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold">2. No-show</h2>
                            <p>
                                Em caso de não comparecimento (no-show), a reserva poderá ser considerada utilizada, com
                                cobrança conforme condições da tarifa contratada.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold">3. Alteração de datas</h2>
                            <p>
                                Alterações estão sujeitas à disponibilidade e podem gerar diferença de tarifa. Solicitações
                                devem ser feitas com antecedência.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold">4. Reembolsos</h2>
                            <p>
                                Quando aplicável, reembolsos serão processados pelo mesmo meio de pagamento da reserva e no
                                prazo operacional do provedor financeiro.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold">5. Contato</h2>
                            <p>
                                Para tratar cancelamentos e alterações, entre em contato com{' '}
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
