"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import SearchWidget from "@/components/SearchWidget";
import { Sparkles, Home, Building2, TreePine, UtensilsCrossed, Waves } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

export default function HomePage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Hero animation
    if (heroRef.current) {
      gsap.from(heroRef.current.children, {
        opacity: 0,
        y: 50,
        duration: 1,
        stagger: 0.2,
        ease: "power3.out",
      });
    }

    // Cards scroll animation
    if (cardsRef.current) {
      const cards = cardsRef.current.querySelectorAll(".accommodation-card");
      gsap.from(cards, {
        scrollTrigger: {
          trigger: cardsRef.current,
          start: "top 80%",
        },
        opacity: 0,
        y: 60,
        duration: 0.8,
        stagger: 0.15,
        ease: "power2.out",
      });
    }
  }, []);

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
      transition: {
        duration: 0.5,
      },
    },
  };

  return (
    <main className="min-h-screen">
      {/* Hero Section with Background Image */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <Image
            src="/fotos/ala-principal/apartamentos/superior/DSC_0076-1920.webp"
            alt="Pousada Delplata - Ala Principal"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/80 to-primary/70" />
        </div>

        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }} />
        </div>

        <div ref={heroRef} className="container relative z-10 text-center space-y-8 py-20">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, type: "spring" }}
            className="inline-block"
          >
            <Sparkles className="w-16 h-16 mx-auto mb-4 text-secondary" />
          </motion.div>

          <h1 className="text-5xl md:text-7xl font-bold font-heading leading-tight text-white">
            Uma das melhores opções em <br />
            <span className="text-secondary">Serra Negra</span>
          </h1>

          <p className="text-xl md:text-2xl text-white/90 max-w-2xl mx-auto">
            Lazer e diversão para você e sua família.
          </p>

          <p className="text-lg md:text-xl text-white/80">
            Conheça nossa região, encante-se!
          </p>

          <div className="max-w-5xl mx-auto mt-12">
            <SearchWidget />
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 1 }}
            className="absolute bottom-10 left-1/2 transform -translate-x-1/2"
          >
            <div className="animate-bounce">
              <svg className="w-6 h-6 text-white/60" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
              </svg>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Accommodations Section */}
      <section className="py-20 bg-background">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={containerVariants}
            className="text-center mb-16"
          >
            <motion.h2 variants={itemVariants} className="text-4xl md:text-5xl font-bold font-heading mb-4">
              Nossas Acomodações
            </motion.h2>
            <motion.p variants={itemVariants} className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Escolha o ambiente perfeito para sua estadia
            </motion.p>
          </motion.div>

          <div ref={cardsRef} className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Apartamento Térreo */}
            <Card className="accommodation-card group hover:scale-105 transition-transform duration-300 cursor-pointer border-2 hover:border-primary overflow-hidden">
              <div className="h-48 relative overflow-hidden">
                <Image
                  src="/fotos/ala-principal/apartamentos/terreo/com-janela/DSC_0005-1200.webp"
                  alt="Apartamento Térreo"
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent" />
                <Home className="absolute bottom-4 right-4 w-12 h-12 text-white" />
              </div>
              <CardHeader>
                <CardTitle className="group-hover:text-primary transition-colors">Apartamento Térreo</CardTitle>
                <CardDescription className="text-base">
                  Apartamentos compostos por: Televisão LCD 24, Frigobar, Guarda Roupa, Ventilador de Teto e Ar condicionado.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/acomodacoes">Ver Detalhes</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Apartamento Superior */}
            <Card className="accommodation-card group hover:scale-105 transition-transform duration-300 cursor-pointer border-2 hover:border-primary overflow-hidden">
              <div className="h-48 relative overflow-hidden">
                <Image
                  src="/fotos/ala-principal/apartamentos/superior/DSC_0069-1200.webp"
                  alt="Apartamento Superior"
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent" />
                <Building2 className="absolute bottom-4 right-4 w-12 h-12 text-white" />
              </div>
              <CardHeader>
                <CardTitle className="group-hover:text-primary transition-colors">Apartamento Superior</CardTitle>
                <CardDescription className="text-base">
                  Apartamentos compostos por: Televisão LCD 24, Frigobar, Guarda Roupa, Ventilador de Teto e Ar condicionado.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/acomodacoes">Ver Detalhes</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Chalés */}
            <Card className="accommodation-card group hover:scale-105 transition-transform duration-300 cursor-pointer border-2 hover:border-primary overflow-hidden">
              <div className="h-48 relative overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=2070&auto=format&fit=crop"
                  alt="Chalés"
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent" />
                <TreePine className="absolute bottom-4 right-4 w-12 h-12 text-white" />
              </div>
              <CardHeader>
                <CardTitle className="group-hover:text-primary transition-colors">Chalés</CardTitle>
                <CardDescription className="text-base">
                  Chalés para até 4 pessoas, compostos por: Tv 20, Frigobar, Guarda roupas e Ventilador de teto.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/acomodacoes">Ver Detalhes</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Leisure & Restaurant Section */}
      <section className="py-20 bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <div className="relative h-64 rounded-2xl overflow-hidden mb-6">
                <Image
                  src="https://images.unsplash.com/photo-1575429198097-0414ec08e8cd?q=80&w=2070&auto=format&fit=crop"
                  alt="Área de Lazer"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent" />
              </div>
              <div className="inline-block p-4 bg-primary/10 rounded-2xl">
                <Waves className="w-12 h-12 text-primary" />
              </div>
              <h2 className="text-4xl font-bold font-heading">Lazer para todos os gostos</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Pensando no seu bem estar o Hotel Pousada Delplata oferece o melhor para o seu lazer
              </p>
              <Button asChild size="lg" className="mt-4">
                <Link href="/lazer">Conheça Nossas Opções</Link>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <div className="relative h-64 rounded-2xl overflow-hidden mb-6">
                <Image
                  src="https://images.unsplash.com/photo-1533777324565-a040eb52facd?q=80&w=2069&auto=format&fit=crop"
                  alt="Café da Manhã"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent" />
              </div>
              <div className="inline-block p-4 bg-secondary/10 rounded-2xl">
                <UtensilsCrossed className="w-12 h-12 text-primary" />
              </div>
              <h2 className="text-4xl font-bold font-heading">Café da manhã servido em um agradável ambiente</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Preparados tudo com muito carinho para você e sua família.
              </p>
              <Button asChild size="lg" variant="secondary" className="mt-4">
                <Link href="/restaurante">Saiba Mais</Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1571896349842-33c89424de2d?q=80&w=2080&auto=format&fit=crop"
            alt="Reserve Agora"
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-primary/90" />
        </div>
        <div className="container relative z-10 text-center text-white">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl mx-auto space-y-8"
          >
            <h2 className="text-4xl md:text-5xl font-bold font-heading">
              Pronto para sua próxima aventura?
            </h2>
            <p className="text-xl text-white/90">
              Reserve agora e garanta os melhores momentos com sua família
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" variant="secondary" className="text-lg px-8">
                <Link href="/reservar">Fazer Reserva</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-lg px-8 bg-white/10 border-white text-white hover:bg-white hover:text-primary">
                <Link href="/contato">Fale Conosco</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
