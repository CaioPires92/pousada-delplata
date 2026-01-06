import Link from "next/link";
import Image from "next/image";
import prisma from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Wifi, Tv, Wind } from "lucide-react";

// Revalidate data every 60 seconds (ISR)
export const revalidate = 60;
export const dynamic = 'force-dynamic';

async function getRooms() {
    const rooms = await prisma.roomType.findMany({
        include: {
            photos: true,
        },
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

    return (
        <main className="min-h-screen bg-background">
            {/* Compact Hero Section */}
            <section className="relative h-[40vh] min-h-[300px] flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0">
                    <Image
                        src="https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=2070&auto=format&fit=crop"
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

            {/* Rooms Grid */}
            <section className="py-16 container">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {rooms.map((room) => (
                        <Card key={room.id} className="group overflow-hidden hover:shadow-xl transition-all duration-300 border-2 hover:border-primary/50">
                            <div className="relative h-64 overflow-hidden">
                                <Image
                                    src={(room.photos[0]?.url?.startsWith('/fotos') && room.photos[0].url) || localCoverFor(room.name)}
                                    alt={room.name}
                                    fill
                                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            </div>

                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <CardTitle className="text-2xl font-heading group-hover:text-primary transition-colors">
                                        {room.name}
                                    </CardTitle>
                                </div>
                                <CardDescription className="line-clamp-2 text-base">
                                    {room.description}
                                </CardDescription>
                            </CardHeader>

                            <CardContent>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                                    <div className="flex items-center gap-1">
                                        <Users className="w-4 h-4" />
                                        <span>Até {room.capacity} pessoas</span>
                                    </div>
                                </div>
                                <div className="flex gap-3 text-muted-foreground">
                                    <Wifi className="w-4 h-4" />
                                    <Tv className="w-4 h-4" />
                                    <Wind className="w-4 h-4" />
                                </div>
                            </CardContent>

                            <CardFooter className="flex items-center justify-between border-t pt-4 bg-muted/20">
                                <div>
                                    <span className="text-xs text-muted-foreground block">A partir de</span>
                                    <span className="text-xl font-bold text-primary">
                                        R$ {Number(room.basePrice).toFixed(2)}
                                    </span>
                                </div>
                                <Button asChild>
                                    <Link href={`/reservar`}>Reservar Agora</Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}

                    {rooms.length === 0 && (
                        <div className="col-span-full text-center py-12">
                            <p className="text-xl text-muted-foreground">
                                Nenhuma acomodação encontrada no momento.
                            </p>
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
}
