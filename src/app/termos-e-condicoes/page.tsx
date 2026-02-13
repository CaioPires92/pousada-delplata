import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Termos e Condições | Pousada Delplata',
    description: 'Termos e condições de uso e reserva da Pousada Delplata.',
};

export default function TermosECondicoesPage() {
    return (
        <main className="min-h-screen bg-muted/30 pt-28 pb-16">
            <div className="container mx-auto max-w-4xl px-4">
                <div className="rounded-xl border border-border/60 bg-white p-6 md:p-8 shadow-sm">
                    <h1 className="text-2xl md:text-3xl font-bold text-primary">Termos e Condições</h1>
                    <p className="mt-2 text-sm text-muted-foreground">Última atualização: 12/02/2026</p>

                    <div className="mt-6 space-y-5 text-sm leading-6 text-foreground">
                        <section>
                            <h2 className="font-semibold">1. Aceite</h2>
                            <p>
                                Ao utilizar o site e realizar reservas na Pousada Delplata, você concorda com estes termos,
                                com a política de cancelamento e com a política de privacidade.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold">2. Reserva e pagamento</h2>
                            <p>
                                As reservas estão sujeitas à disponibilidade. O valor total, condições de pagamento, taxas e
                                regras aplicáveis são exibidos antes da confirmação.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold">3. Dados informados</h2>
                            <p>
                                O hóspede é responsável por informar dados corretos de contato e de identificação. Erros de
                                preenchimento podem impedir confirmação, contato e envio de comprovantes.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold">4. Check-in e check-out</h2>
                            <p>
                                Horários, regras de ocupação e demais condições de hospedagem seguem as informações oficiais
                                da pousada e podem variar por tipo de quarto ou período.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold">5. Cupons e promoções</h2>
                            <p>
                                Cupons de desconto podem ter validade, limite de uso, regras por hóspede, quarto e canal de
                                venda. A pousada pode alterar ou encerrar campanhas promocionais sem aviso prévio.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold">6. Alterações e cancelamentos</h2>
                            <p>
                                Alterações e cancelamentos seguem a política vigente no momento da reserva, disponível em{' '}
                                <Link href="/politica-de-cancelamento" className="text-primary underline">
                                    Política de Cancelamento
                                </Link>
                                .
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold">7. Contato</h2>
                            <p>
                                Dúvidas podem ser enviadas para{' '}
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
