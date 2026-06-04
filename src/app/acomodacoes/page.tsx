import Image from "next/image";
import type { Metadata } from "next";

import prisma from "@/lib/prisma";
import { RoomCard } from "@/components/RoomCard";
import { serializePrismaArray } from "@/lib/serialize-prisma";
import { buildPageMetadata } from "@/lib/seo";


// Revalidate data every 60 seconds (ISR)
export const revalidate = 60;
export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildPageMetadata({
    title: "Acomodações em Serra Negra | Pousada Delplata",
    description:
        "Conheça as acomodações da Pousada Delplata em Serra Negra. Compare alas, quartos, capacidade e consulte disponibilidade online.",
    path: "/acomodacoes",
    image: "/fotos/ala-principal/apartamentos/superior/DSC_0076-1200.webp",
    keywords: [
        "acomodações em Serra Negra",
        "quartos em Serra Negra",
        "chalé em Serra Negra",
        "onde ficar em Serra Negra",
    ],
});

async function getRooms() {
    const rooms = await prisma.roomType.findMany({
        include: {
            photos: true,
        },
        orderBy: {
            basePrice: 'asc',
        }
    });

    // Serialize all Prisma data (Decimal, Date, nested objects)
    return serializePrismaArray(rooms);
}

export default async function RoomsPage() {
    const rooms = await getRooms();

    const mainWingRooms = rooms.filter((r: any) => {
        const n = r.name.toLowerCase();
        return n.includes('superior') || n.includes('terreo') || n.includes('térreo');
    });

    const annexWingRooms = rooms.filter((r: any) => {
        const n = r.name.toLowerCase();
        return n.includes('chale') || n.includes('chalé') || n.includes('anexo');
    });

    const renderRoomGrid = (roomsList: typeof rooms) => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {roomsList.map((room: any) => (
                <RoomCard
                    key={room.id}
                    room={room}
                />
            ))}
        </div>
    );

    return (
        <main className="min-h-screen bg-background">
            <section className="relative flex min-h-[42vh] items-center justify-center overflow-hidden bg-[color:var(--brand-black)]">
                <div className="absolute inset-0">
                    <Image
                        src="/fotos/ala-principal/apartamentos/superior/DSC_0076-1200.webp"
                        alt="Acomodações Pousada Delplata"
                        fill
                        className="object-cover object-center"
                        priority
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(40,50,35,0.78)_0%,rgba(40,50,35,0.52)_42%,rgba(9,9,9,0.24)_100%)]" />
                </div>

                <div className="container relative z-10 py-24 text-center text-white md:py-28">
                    <p className="font-accent text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[color:var(--brand-gold)]">
                        Hospedagem
                    </p>
                    <h1 className="font-hero-display mt-4 text-[2.9rem] font-semibold leading-[0.96] md:text-[4rem]">
                        Nossas Acomodações
                    </h1>
                    <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-white/88 md:text-lg">
                        Conforto e aconchego preparados especialmente para o seu descanso.
                        Escolha o ambiente ideal para sua estadia.
                    </p>
                </div>
            </section>

            <div className="space-y-0">
                {/* Ala Principal Section */}
                <section className="section-space-md bg-[color:var(--brand-cream)]">
                    <div className="container">
                    <div className="mb-10 border-b border-primary/10 pb-4">
                        <h2 className="font-hero-display text-[2.2rem] font-semibold leading-tight text-primary md:text-[3rem]">Ala Principal</h2>
                        <p className="mt-2 text-[1.02rem] leading-7 text-foreground/72">
                            Acomodações proximas a todas as dependências.
                        </p>
                    </div>
                    {renderRoomGrid(mainWingRooms)}
                    </div>
                </section>

                {/* Ala Anexo Section */}
                <section className="section-space-md bg-background">
                    <div className="container">
                    <div className="mb-10 border-b border-primary/10 pb-4">
                        <h2 className="font-hero-display text-[2.2rem] font-semibold leading-tight text-primary md:text-[3rem]">Ala Chalés e Anexos</h2>
                        <p className="mt-2 flex items-center gap-2 text-[1.02rem] leading-7 text-foreground/72">
                            <span className="inline-block w-2 h-2 rounded-full bg-secondary"></span>
                            Localizada a 70 metros da ala principal
                        </p>
                    </div>
                    {renderRoomGrid(annexWingRooms)}
                    </div>
                </section>
            </div>

            {rooms.length === 0 && (
                <div className="container section-space-sm text-center">
                    <p className="text-xl text-muted-foreground">
                        Nenhuma acomodação encontrada no momento.
                    </p>
                </div>
            )}
        </main>
    );
}
