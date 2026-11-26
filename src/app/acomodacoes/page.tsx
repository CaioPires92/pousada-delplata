import Image from "next/image";
import type { Metadata } from "next";

import prisma from "@/lib/prisma";
import { WingShowcaseList, type ShowcaseRoom } from "@/components/WingShowcase";
import { serializePrismaArray } from "@/lib/serialize-prisma";
import { buildPageMetadata } from "@/lib/seo";
import { getRoomAmenitiesList, isAnnexWingRoom, isMainWingRoom, sortRoomsForDisplay } from "@/lib/rooms";
import { getDisplayPhotoUrls } from "@/lib/room-display";
import { getRoomReferencePrices, referencePriceLabel } from "@/lib/room-from-price";
import homeStyles from "@/components/home-novo/home-novo.module.css";


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
    const rooms = sortRoomsForDisplay(await getRooms() as any[]);
    const referencePrices = await getRoomReferencePrices(rooms.map((room: any) => ({ id: room.id, basePrice: Number(room.basePrice) })));

    const toShowcase = (room: any): ShowcaseRoom => ({
        id: room.id,
        name: room.name,
        capacity: Number(room.capacity),
        maxGuests: Number(room.maxGuests),
        amenities: getRoomAmenitiesList(room.amenities),
        photoUrl: getDisplayPhotoUrls(room)[0] ?? null,
        fromPrice: referencePrices.get(room.id)?.price ?? Number(room.basePrice),
        priceLabel: referencePrices.get(room.id) ? referencePriceLabel(referencePrices.get(room.id)!) : "Diária base",
    });

    const mainWingRooms = rooms.filter((r: any) => isMainWingRoom(r.name)).map(toShowcase);
    const annexWingRooms = rooms.filter((r: any) => isAnnexWingRoom(r.name)).map(toShowcase);
    const wings = [
        { title: "Ala", emphasis: "principal", text: "Acomodações próximas a todas as dependências.", rooms: mainWingRooms },
        { title: "Chalés", emphasis: "e anexos", text: "Localizada a 70 metros da ala principal.", rooms: annexWingRooms },
    ].filter((wing) => wing.rooms.length > 0);

    return (
        <main className="min-h-screen bg-background">
            <section data-page-hero className="relative flex min-h-[42vh] items-center justify-center overflow-hidden bg-[color:var(--brand-black)]">
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
                    <p className={`${homeStyles.eyebrow} ${homeStyles.onPhoto} text-[#efe3a0]`}>Hospedagem</p>
                    <h1 className={`${homeStyles.display} ${homeStyles.onPhoto} mt-4 text-[clamp(2.4rem,6vw,4.8rem)] text-white`}>
                        Nossas <em>acomodações</em>
                    </h1>
                    <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-white/88 md:text-lg">
                        Conforto e aconchego preparados especialmente para o seu descanso.
                        Escolha o ambiente ideal para sua estadia.
                    </p>
                </div>
            </section>

            <div>
                <WingShowcaseList wings={wings} />
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
