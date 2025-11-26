"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import styles from "./Header.module.css";

export default function Header() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const pathname = usePathname();
    const isHome = pathname === "/";

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const navLinks = [
        { href: "/acomodacoes", label: "Acomodações" },
        { href: "/lazer", label: "Lazer" },
        { href: "/restaurante", label: "Restaurante" },
        { href: "/contato", label: "Contato" },
    ];

    // Determine header style based on page and scroll state
    const isTransparent = isHome && !isScrolled;

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
                <div className="flex items-center justify-between h-20">
                    {/* Logo */}
                    <Link
                        href="/"
                        className={`text-2xl font-bold font-heading transition-colors duration-300 ${!isTransparent ? "text-primary" : "text-white"
                            }`}
                    >
                        Hotel Pousada Delplata
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center gap-8">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`font-medium transition-colors duration-300 hover:text-secondary ${!isTransparent ? "text-primary" : "text-white"
                                    }`}
                            >
                                {link.label}
                            </Link>
                        ))}
                        <Button asChild variant={!isTransparent ? "default" : "secondary"}>
                            <Link href="/reservar">Reservar</Link>
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
                                key={link.href}
                                href={link.href}
                                className="block text-primary font-medium hover:text-secondary transition-colors"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                {link.label}
                            </Link>
                        ))}
                        <Button asChild className="w-full">
                            <Link href="/reservar" onClick={() => setIsMobileMenuOpen(false)}>
                                Reservar
                            </Link>
                        </Button>
                    </motion.nav>
                )}
            </div>
        </motion.header>
    );
}
