import Image from "next/image";
import { Metadata } from 'next';
import { ContactForm } from "@/components/ContactForm";
import { MapPin, Phone, Mail, MessageCircle, Clock } from "lucide-react";

export const metadata: Metadata = {
    title: 'Contato | Pousada Delplata',
    description: 'Entre em contato conosco para reservas, dúvidas ou eventos. Estamos prontos para atender você.',
};

export default function ContactPage() {
    return (
        <main className="min-h-screen bg-stone-50">
            {/* Hero Section */}
            <section className="relative h-[40vh] min-h-[300px] flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0">
                    <Image
                        src="/fotos/jardim-aptos/DSC_0258.jpg"
                        alt="Contato Pousada Delplata"
                        fill
                        className="object-cover"
                        priority
                    />
                    <div className="absolute inset-0 bg-black/50" />
                </div>

                <div className="container relative z-10 text-center text-white space-y-4">
                    <h1 className="text-4xl md:text-5xl font-bold font-heading">
                        Fale Conosco
                    </h1>
                    <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto font-light">
                        Estamos à disposição para esclarecer suas dúvidas e ajudar no planejamento da sua estadia.
                    </p>
                </div>
            </section>

            <div className="container mx-auto px-4 py-16">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
                    {/* Contact Info Column */}
                    <div className="space-y-12">
                        <div>
                            <h2 className="text-3xl font-bold font-heading text-primary mb-6">Informações de Contato</h2>
                            <p className="text-gray-600 mb-8 leading-relaxed">
                                Você pode entrar em contato conosco através dos canais abaixo ou preencher o formulário. 
                                Nossa equipe retornará o mais breve possível.
                            </p>

                            <div className="space-y-6">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-primary/10 rounded-full text-primary shrink-0">
                                        <MapPin className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">Endereço</h3>
                                        <p className="text-gray-600">R. Vicente Frederico Leporas, 151</p>
                                        <p className="text-gray-600">Bairro das Posses, Serra Negra - SP, 13930-000</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-primary/10 rounded-full text-primary shrink-0">
                                        <Phone className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">Telefone</h3>
                                        <p className="text-gray-600">
                                            <a href="tel:+551938422559" className="hover:text-primary transition-colors">(19) 3842-2559</a>
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-primary/10 rounded-full text-primary shrink-0">
                                        <MessageCircle className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">WhatsApp</h3>
                                        <p className="text-gray-600">
                                            <a href="https://wa.me/5519999654866" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                                                (19) 99965-4866
                                            </a>
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-primary/10 rounded-full text-primary shrink-0">
                                        <Mail className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">E-mail</h3>
                                        <p className="text-gray-600">
                                            <a href="mailto:contato@pousadadelplata.com.br" className="hover:text-primary transition-colors">
                                                contato@pousadadelplata.com.br
                                            </a>
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-primary/10 rounded-full text-primary shrink-0">
                                        <Clock className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">Atendimento</h3>
                                        <p className="text-gray-600">Todos os dias, das 8h às 22h</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Map */}
                        <div className="h-[300px] w-full rounded-2xl overflow-hidden shadow-sm border border-gray-100">
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

                    {/* Contact Form Column */}
                    <div>
                        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-lg border border-primary/10">
                            <h3 className="text-2xl font-bold font-heading text-gray-900 mb-6">Envie uma Mensagem</h3>
                            <ContactForm />
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}