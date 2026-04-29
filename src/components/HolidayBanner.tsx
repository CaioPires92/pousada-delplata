"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function HolidayBanner() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Verifica se o usuário já viu o banner nesta sessão
    const hasSeenBanner = sessionStorage.getItem("holiday-banner-maio-2026");
    if (!hasSeenBanner) {
      // Exibe após 2 segundos de navegação
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    sessionStorage.setItem("holiday-banner-maio-2026", "true");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative z-10 w-full max-w-4xl overflow-hidden rounded-2xl shadow-2xl"
          >
            <button
              onClick={handleClose}
              className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition-colors hover:bg-black/80 focus:outline-none"
              aria-label="Fechar"
            >
              <X size={24} />
            </button>
            <Link
              href="/reservar?checkIn=2026-05-01&checkOut=2026-05-03"
              onClick={handleClose}
              className="block w-full"
            >
              <Image
                src="/banners/banner-01-maio.png"
                alt="Promoção Últimas Vagas Feriado 1º de Maio"
                width={1200}
                height={800}
                className="w-full h-auto object-contain cursor-pointer transition-transform hover:scale-[1.02] duration-500"
                priority
              />
            </Link>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
