import Image from "next/image";
import { ContactForm } from "@/components/ContactForm";
import { MapPin, Phone, Mail, MessageCircle, Clock } from "lucide-react";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
    title: "Contato da Pousada Delplata | Serra Negra",
    description:
        "Fale com a Pousada Delplata para tirar dúvidas, solicitar informações sobre hospedagem e receber suporte para sua reserva em Serra Negra.",
    path: "/contato",
    image: "/fotos/jardim-aptos/DSC_0258.jpg",
});

export default function ContactPage() {
    return (
        <main className="min-h-screen bg-background">
            <section className="relative flex min-h-[42vh] items-center justify-center overflow-hidden bg-[color:var(--brand-black)]">
                <div className="absolute inset-0">
                    <Image
                        src="/fotos/jardim-aptos/DSC_0258.jpg"
                        alt="Contato Pousada Delplata"
                        fill
                        className="object-cover object-center"
                        priority
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(40,50,35,0.78)_0%,rgba(40,50,35,0.52)_42%,rgba(9,9,9,0.24)_100%)]" />
                </div>

                <div className="container relative z-10 py-24 text-center text-white md:py-28">
                    <p className="font-accent text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[color:var(--brand-gold)]">
                        Contato
                    </p>
                    <h1 className="font-hero-display mt-4 text-[2.9rem] font-semibold leading-[0.96] md:text-[4rem]">
                        Fale Conosco
                    </h1>
                    <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-white/88 md:text-lg">
                        Estamos à disposição para esclarecer suas dúvidas e ajudar no planejamento da sua estadia.
                    </p>
                </div>
            </section>

            <section className="section-space-md bg-[color:var(--brand-cream)]">
            <div className="container">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
                    <div className="space-y-12">
                        <div>
                            <h2 className="font-hero-display mb-6 text-[2.2rem] font-semibold leading-tight text-primary md:text-[3rem]">Informações de Contato</h2>
                            <p className="mb-8 leading-relaxed text-foreground/72">
                                Você pode entrar em contato conosco através dos canais abaixo ou preencher o formulário. 
                                Nossa equipe retornará o mais breve possível.
                            </p>

                            <div className="space-y-6">
                                <div className="flex items-start gap-4">
                                    <div className="shrink-0 border border-primary/10 bg-[color:var(--brand-white)] p-3 text-primary">
                                        <MapPin className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-sans font-semibold text-primary">Endereço</h3>
                                        <p className="text-foreground/72">R. Vicente Frederico Leporas, 151</p>
                                        <p className="text-foreground/72">Bairro das Posses, Serra Negra - SP, 13930-000</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="shrink-0 border border-primary/10 bg-[color:var(--brand-white)] p-3 text-primary">
                                        <Phone className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-sans font-semibold text-primary">Telefone</h3>
                                        <p className="text-foreground/72">
                                            <a href="tel:+551938422559" className="hover:text-primary transition-colors">(19) 3842-2559</a>
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="shrink-0 border border-primary/10 bg-[color:var(--brand-white)] p-3 text-primary">
                                        <MessageCircle className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-sans font-semibold text-primary">WhatsApp</h3>
                                        <p className="text-foreground/72">
                                            <a href="https://wa.me/5519999654866" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                                                (19) 99965-4866
                                            </a>
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="shrink-0 border border-primary/10 bg-[color:var(--brand-white)] p-3 text-primary">
                                        <Mail className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-sans font-semibold text-primary">E-mail</h3>
                                        <p className="text-foreground/72">
                                            <a href="mailto:contato@pousadadelplata.com.br" className="hover:text-primary transition-colors">
                                                contato@pousadadelplata.com.br
                                            </a>
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="shrink-0 border border-primary/10 bg-[color:var(--brand-white)] p-3 text-primary">
                                        <Clock className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-sans font-semibold text-primary">Atendimento</h3>
                                        <p className="text-foreground/72">Todos os dias, das 8h às 22h</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="h-[300px] w-full overflow-hidden border border-primary/10">
                            <iframe 
                                src="https://maps.google.com/maps?q=R.+Vicente+Frederico+Leporas,+151,+Bairro+das+Posses,+Serra+Negra+-+SP,+13930-000&t=&z=15&ie=UTF8&iwloc=&output=embed"
                                width="100%" 
                                height="100%" 
                                style={{ border: 0 }} 
                                allowFullScreen 
                                loading="lazy" 
                                referrerPolicy="no-referrer-when-downgrade"
                            ></iframe>
                        </div>
                    </div>

                    <div>
                        <div className="border border-primary/10 bg-[color:var(--brand-white)] p-6 md:p-8">
                            <h3 className="mb-6 font-sans text-[2rem] font-semibold leading-tight text-primary">Envie uma Mensagem</h3>
                            <ContactForm />
                        </div>
                    </div>
                </div>
            </div>
            </section>
        </main>
    );
}
