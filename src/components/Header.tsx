"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
        <header
            className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${!isTransparent
                ? "border-b border-[color:var(--line-dark)] bg-[color:var(--brand-cream)] shadow-[0_8px_24px_rgba(9,9,9,0.06)]"
                : "bg-transparent"
                }`}
        >
            <div className="container">
                <div className={`flex items-center justify-between ${isHomeHero ? "h-28 lg:h-32" : "h-22"}`}>
                    {/* Logo */}
                    <Link
                        href="/"
                        onClick={handleHomeClick}
                        className={`relative transition-opacity hover:opacity-90 ${isHomeHero ? "h-20 w-44 sm:h-24 sm:w-56 lg:h-28 lg:w-64" : "h-24 w-72"}`}
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
                                    ? "font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--brand-white)] [text-shadow:0_2px_12px_rgba(0,0,0,0.62)]"
                                    : !isTransparent
                                        ? "font-sans font-medium text-primary/90"
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
                                ? "h-14 rounded-none border border-[color:var(--brand-gold)]/60 bg-[color:var(--forest-soft)] px-6 font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--brand-white)] shadow-none transition-all duration-200 hover:-translate-y-px hover:border-[color:var(--brand-white)]/70 hover:bg-[color:var(--brand-forest)] hover:text-[color:var(--brand-white)]"
                                : "rounded-none bg-primary text-white shadow-none transition-all duration-300 hover:-translate-y-px hover:bg-primary/90 hover:shadow-[0_8px_18px_rgba(9,9,9,0.08)]"}
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
                    <nav className="md:hidden space-y-4 border-t border-[color:var(--line-dark)] bg-[color:var(--brand-cream)] px-4 pb-6 pt-5">
                        {navLinks.map((link) => (
                            <Link
                                key={`${link.href}-${link.label}`}
                                href={link.href}
                                className="block text-primary/90 font-medium hover:text-secondary transition-colors"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                {link.label}
                            </Link>
                        ))}
                        <Button asChild className="w-full rounded-none shadow-none">
                            <Link href="/reservar" onClick={() => { trackClickReservar('header_mobile'); setIsMobileMenuOpen(false); }}>
                                Reservar
                            </Link>
                        </Button>
                    </nav>
                )}
            </div>
        </header>
    );
}
