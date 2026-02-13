import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Política de Privacidade | Pousada Delplata',
    description: 'Política de privacidade da Pousada Delplata.',
};

export default function PoliticaDePrivacidadePage() {
    return (
        <main className="min-h-screen bg-muted/30 pt-28 pb-16">
            <div className="container mx-auto max-w-4xl px-4">
                <div className="rounded-xl border border-border/60 bg-white p-6 md:p-8 shadow-sm">
                    <h1 className="text-2xl md:text-3xl font-bold text-primary">Política de Privacidade</h1>
                    <p className="mt-2 text-sm text-muted-foreground">Última atualização: 12/02/2026</p>

                    <div className="mt-6 space-y-5 text-sm leading-6 text-foreground">
                        <section>
                            <h2 className="font-semibold">1. Dados coletados</h2>
                            <p>
                                Coletamos dados necessários para atendimento e hospedagem, como nome, e-mail, telefone,
                                período da reserva, dados de pagamento e informações de navegação.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold">2. Finalidade</h2>
                            <p>
                                Utilizamos os dados para processar reservas, confirmar pagamentos, enviar comunicações da
                                hospedagem, atendimento ao cliente e cumprimento de obrigações legais.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold">3. Compartilhamento</h2>
                            <p>
                                Podemos compartilhar dados com provedores estritamente necessários para operação, como
                                processamento de pagamentos, e-mail transacional e infraestrutura de hospedagem.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold">4. Armazenamento e segurança</h2>
                            <p>
                                Adotamos medidas técnicas e organizacionais para proteger as informações contra acesso não
                                autorizado, perda, alteração ou divulgação indevida.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold">5. Direitos do titular</h2>
                            <p>
                                Você pode solicitar confirmação de tratamento, acesso, correção e exclusão dos dados, quando
                                aplicável, pelos canais oficiais de contato.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold">6. Contato</h2>
                            <p>
                                Para dúvidas sobre privacidade, fale com a Pousada Delplata em{' '}
                                <a className="text-primary underline" href="mailto:contato@pousadadelplata.com.br">
                                    contato@pousadadelplata.com.br
                                </a>
                                .
                            </p>
                        </section>
                    </div>
                </div>
            </div>
        </main>
    );
}
