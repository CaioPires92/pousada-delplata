"use client";

 
import { motion } from "framer-motion";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import SearchWidget from "@/components/SearchWidget";
import { Sparkles, Waves, UtensilsCrossed, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";



export default function HomeContent() {
  /* Removed GSAP refs and effects to fix re-render flash */
  /* Using purely Framer Motion for stable SSR/Hydration */

  const containerVariants: any = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants: any = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: "easeOut",
      },
    },
  };

  const wings = [
    {
      id: 'ala-principal',
      title: 'Ala Principal',
      description: 'Conforto e praticidade. Inclui Apartamentos Térreo e Superior.',
      image: '/fotos/ala-principal/apartamentos/superior/DSC_0069-1200.webp',
      link: '/acomodacoes'
    },
    {
      id: 'ala-anexo',
      title: 'Ala Chalés e Anexos',
      description: 'Privacidade e contato com a natureza. Inclui Chalés e Apartamentos Anexo.',
      image: '/fotos/ala-chales/chales/IMG_0125-1200.webp',
      link: '/acomodacoes'
    }
  ];

  return (
    <main className="min-h-screen">
      {/* Hero Section with Background Image */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <Image
            src="/fotos/ala-principal/apartamentos/superior/DSC_0076-1200.webp"
            alt="Pousada Delplata - Ala Principal"
            fill
            sizes="100vw"
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

        <motion.div
          className="container relative z-10 text-center space-y-8 py-20"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <motion.div
            variants={itemVariants}
            className="inline-block"
          >
            <Sparkles className="w-16 h-16 mx-auto mb-4 text-secondary" />
          </motion.div>

          <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-bold font-heading leading-tight text-white">
            Uma das melhores opções em <br />
            <span className="text-secondary">Serra Negra</span>
          </motion.h1>

          <motion.p variants={itemVariants} className="text-xl md:text-2xl text-white/90 max-w-2xl mx-auto">
            Lazer e diversão para você e sua família.
          </motion.p>

          <motion.p variants={itemVariants} className="text-lg md:text-xl text-white/80">
            Conheça nossa região, encante-se!
          </motion.p>

          <motion.div variants={itemVariants} className="max-w-5xl mx-auto mt-12 mb-8 md:mb-0">
            <SearchWidget />
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 1 }}
            className="absolute bottom-10 left-1/2 transform -translate-x-1/2 hidden md:block"
          >
            <div className="animate-bounce">
              <svg className="w-6 h-6 text-white/60" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
              </svg>
            </div>
          </motion.div>
        </motion.div>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {wings.map((wing, index) => (
              <motion.div
                key={wing.id}
                className="wing-card h-full"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
              >
                <Link href={wing.link} className="block h-full group">
                  <Card className="overflow-hidden h-full border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-xl rounded-3xl">
                    <div className="relative h-96 overflow-hidden">
                      <Image
                        src={wing.image}
                        alt={wing.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className="object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-30 group-hover:opacity-80 transition-opacity" />
                      <div className="absolute bottom-0 left-0 p-8 text-white w-full">
                        <h3 className="text-3xl md:text-4xl font-bold font-heading mb-3">{wing.title}</h3>
                        <p className="text-white/90 text-lg mb-6 line-clamp-2">{wing.description}</p>
                        <div className="flex items-center text-secondary font-bold uppercase tracking-wider group-hover:translate-x-2 transition-transform">
                          Ver opções <ArrowRight className="ml-2 w-5 h-5" />
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Button asChild size="lg" variant="outline" className="text-lg px-8">
              <Link href="/acomodacoes">Ver Todas as Acomodações</Link>
            </Button>
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
                  src="/fotos/piscina-aptos/DJI_0863.jpg"
                  alt="Área de Lazer"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
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
                  src="/fotos/restaurante/DSC_0056.jpg"
                  alt="Café da Manhã"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
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
            src="/fotos/piscina-aptos/DJI_0908.jpg"
            alt="Reserve Agora"
            fill
            sizes="100vw"
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
