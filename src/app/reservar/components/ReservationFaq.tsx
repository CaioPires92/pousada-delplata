import Link from 'next/link';

const FAQ_ITEMS = [
    {
        question: 'Como consultar valores e disponibilidade?',
        answer: 'Informe check-in, check-out e hóspedes. O motor mostra as acomodações disponíveis e o valor total para as datas escolhidas.',
    },
    {
        question: 'Quais meios de pagamento aparecem no site?',
        answer: 'O pagamento pode apresentar Pix ou cartão. As opções disponíveis são mostradas pelo Mercado Pago antes da conclusão.',
    },
    {
        question: 'Onde consulto as condições de cancelamento?',
        answer: 'Consulte as condições apresentadas antes de continuar e a política completa. Em caso de dúvida, fale diretamente com a pousada.',
    },
] as const;

export default function ReservationFaq() {
    return (
        <section aria-labelledby="reservation-faq-title" className="container mx-auto box-border w-full max-w-full px-4 pb-4 pt-12">
            <div className="border-t border-primary/10 pt-8">
                <h2 id="reservation-faq-title" className="text-2xl font-semibold text-primary">Dúvidas antes de reservar</h2>
                <div className="mt-5 grid gap-3 lg:grid-cols-3">
                    {FAQ_ITEMS.map((item) => (
                        <details key={item.question} className="group border border-primary/10 bg-white p-4">
                            <summary className="cursor-pointer font-medium text-primary">{item.question}</summary>
                            <p className="mt-3 text-sm leading-6 text-foreground/75">{item.answer}</p>
                        </details>
                    ))}
                </div>
                <p className="mt-4 text-sm text-foreground/70">
                    Consulte a{' '}
                    <Link href="/politica-de-cancelamento" className="font-medium text-primary underline underline-offset-2">
                        política de cancelamento
                    </Link>{' '}
                    ou fale com a pousada pelo WhatsApp (19) 99965-4866.
                </p>
            </div>
        </section>
    );
}
