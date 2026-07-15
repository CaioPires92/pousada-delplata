export default function ReservationPageFallback() {
    return (
        <main className="min-h-screen bg-[color:var(--brand-cream)] px-4 pb-16 pt-32">
            <section className="mx-auto max-w-3xl border border-primary/10 bg-[color:var(--brand-white)] px-6 py-10 text-center md:px-10 md:py-14">
                <p className="font-accent text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[color:var(--brand-gold)]">
                    Reservas
                </p>
                <h1 className="mt-4 font-sans text-3xl font-semibold text-primary md:text-4xl">
                    Preparando sua consulta de disponibilidade
                </h1>
                <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-foreground/72">
                    Aguarde enquanto carregamos as datas, a ocupação e as acomodações cadastradas.
                </p>
                <div className="mx-auto mt-8 h-1.5 max-w-sm overflow-hidden bg-primary/10" aria-hidden="true">
                    <div className="h-full w-1/2 animate-pulse bg-primary" />
                </div>
            </section>
        </main>
    );
}
