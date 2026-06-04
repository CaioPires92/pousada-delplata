"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { trackClickReservar } from "@/lib/analytics";

export default function Header() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const pathname = usePathname();

    // Pages that should have a transparent header initially
    const transparentPaths = ["/", "/acomodacoes", "/lazer", "/restaurante", "/contato"];
    const isTransparentPath = transparentPaths.includes(pathname);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const navLinks = [
        { href: "/blog", label: "Blog" },
        { href: "/acomodacoes", label: "Acomodações" },
        { href: "/lazer", label: "Lazer" },
        { href: "/restaurante", label: "Restaurante" },
        { href: "/contato", label: "Contato" },
    ];

    // Determine header style based on page and scroll state
    const isTransparent = isTransparentPath && !isScrolled;

    const handleHomeClick = (e: React.MouseEvent) => {
        e.preventDefault();
        // Force full page reload to clear all client state and ensure a fresh start
        window.location.href = "/";
    };

    if (pathname.startsWith('/admin')) return null;

    const isHomeHero = pathname === "/" && isTransparent;

    return (
        <motion.header
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.5 }}
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${!isTransparent
                ? "bg-white/95 backdrop-blur-md shadow-lg"
                : "bg-transparent"
                }`}
        >
            <div className="container">
                <div className={`flex items-center justify-between ${isHomeHero ? "h-28 lg:h-32" : "h-24"}`}>
                    {/* Logo */}
                    <Link
                        href="/"
                        onClick={handleHomeClick}
                        className={`relative transition-opacity hover:opacity-90 ${isHomeHero ? "h-20 w-44 sm:h-24 sm:w-56 lg:h-28 lg:w-64" : "h-24 w-80"}`}
                    >
                        <Image
                            src="/fotos/logo.png"
                            alt="Hotel Pousada Delplata"
                            fill
                            sizes="(max-width: 768px) 100vw, 320px"
                            className="object-contain object-left"
                            priority
                        />
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className={`hidden md:flex items-center ${isHomeHero ? "gap-5 lg:gap-9" : "gap-8"}`}>
                        {navLinks.map((link) => (
                            <Link
                                key={`${link.href}-${link.label}`}
                                href={link.href}
                                className={`transition-colors duration-300 hover:text-secondary ${isHomeHero
                                    ? "font-sans text-[11px] font-medium uppercase tracking-[0.28em] text-[#d6c089] drop-shadow-[0_1px_6px_rgba(0,0,0,0.45)]"
                                    : !isTransparent
                                        ? "font-sans font-medium text-primary"
                                        : "font-sans font-medium text-white"
                                    }`}
                            >
                                {link.label}
                            </Link>
                        ))}
                        <Button
                            asChild
                            variant={!isTransparent ? "default" : "secondary"}
                            className={isHomeHero
                                ? "h-14 rounded-sm border border-secondary/70 bg-transparent px-6 font-sans text-[11px] font-semibold uppercase tracking-[0.28em] text-white shadow-none transition-all duration-300 hover:-translate-y-0.5 hover:border-secondary hover:bg-secondary/12 hover:text-white hover:shadow-[0_10px_24px_rgba(187,184,99,0.12)]"
                                : ""}
                        >
                            <Link href="/reservar" onClick={() => trackClickReservar('header_desktop')}>
                                Reservas
                            </Link>
                        </Button>
                    </nav>

                    {/* Mobile Menu Button */}
                    <button
                        className={`md:hidden p-2 ${!isTransparent ? "text-primary" : "text-white"}`}
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>

                {/* Mobile Navigation */}
                {isMobileMenuOpen && (
                    <motion.nav
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="md:hidden pb-6 space-y-4 bg-white px-4 rounded-b-lg shadow-lg"
                    >
                        {navLinks.map((link) => (
                            <Link
                                key={`${link.href}-${link.label}`}
                                href={link.href}
                                className="block text-primary font-medium hover:text-secondary transition-colors"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                {link.label}
                            </Link>
                        ))}
                        <Button asChild className="w-full">
                            <Link href="/reservar" onClick={() => { trackClickReservar('header_mobile'); setIsMobileMenuOpen(false); }}>
                                Reservar
                            </Link>
                        </Button>
                    </motion.nav>
                )}
            </div>
        </motion.header>
    );
}



