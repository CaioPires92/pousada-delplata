import Link from "next/link";
import Image from "next/image";
import prisma from "@/lib/prisma";
import { RoomCard } from "@/components/RoomCard";

// Revalidate data every 60 seconds (ISR)
export const revalidate = 60;
export const dynamic = 'force-dynamic';

async function getRooms() {
    const rooms = await prisma.roomType.findMany({
        include: {
            photos: true,
        },
        orderBy: {
            basePrice: 'asc',
        }
    });
    return rooms;
}

export default async function RoomsPage() {
    const rooms = await getRooms();

    function localCoverFor(name: string) {
        const n = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        if (n.includes('chale')) return '/fotos/ala-chales/chales/IMG_0125-1200.webp'
        if (n.includes('anexo')) return '/fotos/ala-chales/apartamentos-anexo/IMG_0029-1200.webp'
        if (n.includes('superior')) return '/fotos/ala-principal/apartamentos/superior/DSC_0069-1200.webp'
        if (n.includes('terreo')) return '/fotos/ala-principal/apartamentos/terreo/com-janela/DSC_0005-1200.webp'
        return '/fotos/ala-principal/apartamentos/superior/DSC_0076-1200.webp'
    }

    const mainWingRooms = rooms.filter(r => {
        const n = r.name.toLowerCase();
        return n.includes('superior') || n.includes('terreo') || n.includes('térreo');
    });

    const annexWingRooms = rooms.filter(r => {
        const n = r.name.toLowerCase();
        return n.includes('chale') || n.includes('chalé') || n.includes('anexo');
    });

    const renderRoomGrid = (roomsList: typeof rooms) => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {roomsList.map((room) => {
                const coverUrl = (room.photos[0]?.url?.startsWith('/fotos') && room.photos[0].url) || localCoverFor(room.name);
                const serializedRoom = {
                    ...room,
                    basePrice: Number(room.basePrice)
                };

                return (
                    <RoomCard
                        key={room.id}
                        room={serializedRoom}
                        coverUrl={coverUrl}
                    />
                );
            })}
        </div>
    );

    return (
        <main className="min-h-screen bg-background">
            {/* Compact Hero Section */}
            <section className="relative h-[40vh] min-h-[300px] flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0">
                    <Image
                        src="/fotos/ala-principal/apartamentos/superior/DSC_0076-1200.webp"
                        alt="Acomodações Pousada Delplata"
                        fill
                        className="object-cover"
                        priority
                    />
                    <div className="absolute inset-0 bg-black/50" />
                </div>

                <div className="container relative z-10 text-center text-white space-y-4">
                    <h1 className="text-4xl md:text-5xl font-bold font-heading">
                        Nossas Acomodações
                    </h1>
                    <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto font-light">
                        Conforto e aconchego preparados especialmente para o seu descanso.
                        Escolha o ambiente ideal para sua estadia.
                    </p>
                </div>
            </section>

            <div className="space-y-16 py-16">
                {/* Ala Principal Section */}
                <section className="container">
                    <div className="mb-10 border-b pb-4">
                        <h2 className="text-3xl md:text-4xl font-bold font-heading text-primary">Ala Principal</h2>
                        <p className="text-lg text-muted-foreground mt-2">
                            Acomodações proximas a todas as dependências.
                        </p>
                    </div>
                    {renderRoomGrid(mainWingRooms)}
                </section>

                {/* Ala Anexo Section */}
                <section className="container">
                    <div className="mb-10 border-b pb-4">
                        <h2 className="text-3xl md:text-4xl font-bold font-heading text-primary">Ala Chalés e Anexos</h2>
                        <p className="text-lg text-muted-foreground mt-2 flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full bg-secondary"></span>
                            Localizada a 70 metros da ala principal
                        </p>
                    </div>
                    {renderRoomGrid(annexWingRooms)}
                </section>
            </div>

            {rooms.length === 0 && (
                <div className="container py-12 text-center">
                    <p className="text-xl text-muted-foreground">
                        Nenhuma acomodação encontrada no momento.
                    </p>
                </div>
            )}
        </main>
    );
}
