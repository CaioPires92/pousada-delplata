"use client";

import { motion } from "framer-motion";
import { MapPin, Phone, Mail, MessageCircle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function Footer() {
    const currentYear = new Date().getFullYear();

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
            },
        },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
        },
    };

    return (
        <footer className="bg-primary text-white">
            <div className="container py-16">
                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={containerVariants}
                    className="grid grid-cols-1 md:grid-cols-3 gap-12"
                >
                    {/* About */}
                    <motion.div variants={itemVariants} className="space-y-4">
                        <div className="relative h-32 w-80">
                            <Image
                                src="/fotos/logo.png"
                                alt="Hotel Pousada Delplata"
                                fill
                                sizes="(max-width: 768px) 100vw, 320px"
                                className="object-contain object-left"
                            />
                        </div>
                        <p className="text-white/80 leading-relaxed">
                            O Hotel Pousada Delplata é um local tranquilo e rodeado de muita natureza, ambiente ideal para descansar, sair da rotina e renovar as energias.
                        </p>
                    </motion.div>

                    {/* Quick Links */}
                    <motion.div variants={itemVariants} className="space-y-4">
                        <h4 className="text-xl font-semibold font-heading">Links Rápidos</h4>
                        <ul className="space-y-3">
                            {[
                                { href: "/acomodacoes", label: "Acomodações" },
                                { href: "/lazer", label: "Lazer" },
                                { href: "/contato", label: "Contato" },
                                { href: "/admin/login", label: "Área Administrativa" },
                            ].map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="text-white/80 hover:text-secondary transition-colors duration-300 inline-flex items-center group"
                                    >
                                        <span className="w-0 group-hover:w-2 h-0.5 bg-secondary transition-all duration-300 mr-0 group-hover:mr-2" />
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </motion.div>

                    {/* Contact */}
                    <motion.div variants={itemVariants} className="space-y-4">
                        <h4 className="text-xl font-semibold font-heading">Contato</h4>
                        <ul className="space-y-3">
                            <li className="flex items-start gap-3 text-white/80">
                                <MapPin className="w-5 h-5 mt-1 flex-shrink-0 text-secondary" />
                                <div>
                                    <p>R. Vicente Frederico Leporas, 151</p>
                                    <p>Bairro das Posses, Serra Negra - SP, 13930-000</p>
                                </div>
                            </li>
                            <li className="flex items-center gap-3 text-white/80 hover:text-secondary transition-colors">
                                <Phone className="w-5 h-5 flex-shrink-0" />
                                <a href="tel:+551938422559">(19) 3842-2559</a>
                            </li>
                            <li className="flex items-center gap-3 text-white/80 hover:text-secondary transition-colors">
                                <MessageCircle className="w-5 h-5 flex-shrink-0" />
                                <a href="https://wa.me/5519999654866" target="_blank" rel="noopener noreferrer">
                                    (19) 99965-4866
                                </a>
                            </li>
                            <li className="flex items-center gap-3 text-white/80 hover:text-secondary transition-colors">
                                <Mail className="w-5 h-5 flex-shrink-0" />
                                <a href="mailto:contato@pousadadelplata.com.br">
                                    contato@pousadadelplata.com.br
                                </a>
                            </li>
                        </ul>
                    </motion.div>
                </motion.div>
            </div>

            {/* Copyright */}
            <div className="border-t border-white/10">
                <div className="container py-6">
                    <motion.p
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        className="text-center text-white/60 text-sm"
                    >
                        © {currentYear} Hotel Pousada Delplata. Todos os direitos reservados.
                    </motion.p>
                </div>
            </div>
        </footer>
    );
}
