import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { cache } from "react";

import prisma from "@/lib/prisma";
import { serializePrismaArray, serializePrismaEntity } from "@/lib/serialize-prisma";
import { notFound } from "next/navigation";
import homeStyles from "@/components/home-novo/home-novo.module.css";
import RoomGallery from "@/components/RoomGallery";
import { formatBrl, getDisplayPhotoUrls } from "@/lib/room-display";
import { getRoomReferencePrices, referencePriceLabel } from "@/lib/room-from-price";
import { roomAcceptsPets } from "@/lib/pet-policy";
import { buildPageMetadata, stripHtml } from "@/lib/seo";
import { getRoomAmenitiesList, isAnnexWingRoom, isMainWingRoom } from "@/lib/rooms";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

const getAllRooms = cache(async () => {
    const rooms = await prisma.roomType.findMany({ include: { photos: true }, orderBy: { basePrice: 'asc' } });
    return serializePrismaArray(rooms) as any[];
});

const getRoom = cache(async (id: string) => {
    const room = await prisma.roomType.findUnique({
        where: { id },
        include: {
            photos: true,
        },
    });

    // Serialize Prisma data (Decimal → number, Date → ISO string)
    return room ? serializePrismaEntity(room) : null;
});

export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string }>;
}): Promise<Metadata> {
    const { id } = await params;
    const room = await getRoom(id);

    if (!room) {
        return buildPageMetadata({
            title: "Acomodação não encontrada | Pousada Delplata",
            description: "A acomodação procurada não foi encontrada.",
            path: `/acomodacoes/${id}`,
            noIndex: true,
        });
    }

    const summary = stripHtml(room.description ?? "").slice(0, 155);

    return buildPageMetadata({
        title: `${room.name} em Serra Negra | Pousada Delplata`,
        description:
            summary.length > 0
                ? summary
                : `Veja detalhes da acomodação ${room.name}, capacidade, comodidades e disponibilidade na Pousada Delplata.`,
        path: `/acomodacoes/${room.id}`,
        image: room.photos[0]?.url,
        keywords: [
            room.name,
            "acomodação em Serra Negra",
            "quarto na Pousada Delplata",
        ],
    });
}

export default async function RoomDetailsPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const room = await getRoom(id);

    if (!room) {
        notFound();
    }

    const amenities = getRoomAmenitiesList(room.amenities);
    const photoUrls = getDisplayPhotoUrls(room);
    const wingLabel = isMainWingRoom(room.name) ? "Ala principal" : "Chalés e anexos";
    const capacity = Number(room.capacity);
    const maxGuests = Number(room.maxGuests);
    const guests = maxGuests > capacity ? `${capacity} hóspedes · até ${maxGuests} em quartos selecionados` : `${capacity} hóspedes`;
    const pets = roomAcceptsPets(room.name);

    // Navegação entre quartos: ala principal primeiro, depois chalés e anexos.
    const allRooms = await getAllRooms();
    const ordered = [
        ...allRooms.filter((item) => isMainWingRoom(item.name)),
        ...allRooms.filter((item) => isAnnexWingRoom(item.name) && !isMainWingRoom(item.name)),
    ];
    const otherRooms = ordered.filter((item) => item.id !== room.id);
    const referencePrices = await getRoomReferencePrices(ordered.map((item) => ({ id: item.id, basePrice: Number(item.basePrice) })));
    const reference = referencePrices.get(room.id) ?? { price: Number(room.basePrice), dateKey: null, isToday: false };

    return (
        <main className="min-h-screen bg-background">
            <section data-page-hero className="relative flex min-h-[52svh] items-end overflow-hidden bg-[color:var(--brand-black)]">
                {photoUrls[0] ? (
                    <div className="absolute inset-0">
                        <Image src={photoUrls[0]} alt={room.name} fill priority sizes="100vw" quality={80} className="object-cover object-center" />
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,28,18,0.5)_0%,rgba(20,28,18,0.1)_35%,rgba(20,28,18,0.85)_100%)]" />
                    </div>
                ) : null}
                <div className="container relative z-10 pb-10 pt-32 text-white">
                    <Link href="/acomodacoes" className="text-xs font-bold uppercase tracking-[0.14em] text-[#efe3a0] underline underline-offset-4">
                        &larr; Todas as acomodações
                    </Link>
                    <p className={`${homeStyles.eyebrow} ${homeStyles.onPhoto} mt-5 text-[#efe3a0]`}>{wingLabel}</p>
                    <h1 className={`${homeStyles.display} ${homeStyles.onPhoto} mt-3 text-[clamp(2.2rem,6vw,4.8rem)] text-white`}>{room.name}</h1>
                    <p className="mt-3 text-sm text-white/90 md:text-base">
                        {guests} · {pets ? "aceita pets de pequeno porte" : "não aceita pets"}
                    </p>
                </div>
            </section>

            <nav
                aria-label="Navegar entre as acomodações"
                className="sticky top-[97px] z-30 border-b border-[color:var(--line-dark)] bg-[color:var(--brand-cream)]"
            >
                <div className="container flex items-center gap-1 overflow-x-auto whitespace-nowrap py-2 text-sm">
                    <Link
                        href="/acomodacoes"
                        className="mr-3 inline-flex h-10 shrink-0 items-center border-r border-[color:var(--line-dark)] pr-4 text-xs font-bold uppercase tracking-[0.14em] text-primary hover:text-[#7a7720]"
                    >
                        &larr; Acomodações
                    </Link>
                    {ordered.map((item) => (
                        <Link
                            key={item.id}
                            href={`/acomodacoes/${item.id}`}
                            aria-current={item.id === room.id ? "page" : undefined}
                            className={`inline-flex h-10 shrink-0 items-center px-3 font-medium transition-colors ${
                                item.id === room.id
                                    ? "border-b-2 border-[color:var(--brand-gold)] font-bold text-primary"
                                    : "text-primary/70 hover:text-primary"
                            }`}
                        >
                            {item.name}
                        </Link>
                    ))}
                </div>
            </nav>

            <section className="container grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:py-14">
                <div className="min-w-0 space-y-10">
                    <RoomGallery roomName={room.name} photoUrls={photoUrls} />

                    <div>
                        <p className={`${homeStyles.eyebrow} text-primary`}>Sobre</p>
                        <h2 className={`${homeStyles.display} ${homeStyles.displayDark} mt-3 text-[clamp(1.7rem,3.4vw,2.6rem)] text-primary`}>
                            Sobre a <em>acomodação</em>
                        </h2>
                        <div
                            className="mt-4 max-w-[68ch] text-base leading-8 text-foreground/80"
                            dangerouslySetInnerHTML={{ __html: (room.description ?? "").replace(/\n/g, "<br />") }}
                        />
                    </div>

                    {amenities.length > 0 ? (
                        <div>
                            <h2 className={`${homeStyles.display} ${homeStyles.displayDark} text-[clamp(1.7rem,3.4vw,2.6rem)] text-primary`}>
                                Comodi<em>dades</em>
                            </h2>
                            <ul className="mt-4 flex flex-wrap gap-2">
                                {amenities.map((amenity) => (
                                    <li key={amenity} className="border border-primary/20 px-3 py-1.5 text-sm text-primary">
                                        {amenity}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}
                </div>

                <aside className="lg:sticky lg:top-[120px] lg:self-start">
                    <div className="border border-primary/10 bg-white p-6">
                        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-foreground/70">{referencePriceLabel(reference)}</p>
                        <p className={`${homeStyles.display} mt-1 text-[2.6rem] text-primary`}>
                            {formatBrl(reference.price)} <span className="text-sm font-normal normal-case tracking-normal text-foreground/70">por noite</span>
                        </p>
                        <p className="mt-2 text-xs leading-5 text-foreground/70">
                            Valor da diária para 2 adultos nessa data. Em outras datas, com mais hóspedes ou com promoções o valor muda: escolha suas datas para ver o total exato.
                        </p>
                        <Link
                            href={`/reservar?roomTypeId=${room.id}`}
                            className="mt-5 flex h-12 items-center justify-center bg-[color:var(--brand-gold)] px-6 text-sm font-bold uppercase tracking-[0.08em] text-[color:var(--brand-forest)] transition-opacity hover:opacity-90"
                        >
                            Escolher datas e ver o total
                        </Link>
                        <p className="mt-4 text-xs text-foreground/70">Reserva direta no site oficial, com pagamento por Pix ou cartão.</p>
                    </div>
                </aside>
            </section>

            {otherRooms.length > 0 ? (
                <section className="border-t border-[color:var(--line-dark)] bg-[color:var(--brand-cream)] py-12">
                    <div className="container">
                        <p className={`${homeStyles.eyebrow} text-primary`}>Continue explorando</p>
                        <h2 className={`${homeStyles.display} ${homeStyles.displayDark} mt-3 text-[clamp(1.7rem,3.4vw,2.6rem)] text-primary`}>
                            Outras <em>acomodações</em>
                        </h2>
                        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {otherRooms.map((item) => {
                                const photo = getDisplayPhotoUrls(item)[0];
                                const itemReference = referencePrices.get(item.id) ?? { price: Number(item.basePrice), dateKey: null, isToday: false };
                                return (
                                    <li key={item.id}>
                                        <Link href={`/acomodacoes/${item.id}`} className="group block overflow-hidden border border-primary/10 bg-white">
                                            <div className="relative aspect-[16/10] bg-[color:var(--brand-black)]">
                                                {photo ? (
                                                    <Image
                                                        src={photo}
                                                        alt={`Foto do ${item.name}`}
                                                        fill
                                                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                                        quality={75}
                                                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                                                    />
                                                ) : null}
                                            </div>
                                            <div className="flex items-end justify-between gap-4 p-4">
                                                <div>
                                                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-foreground/60">
                                                        {isMainWingRoom(item.name) ? "Ala principal" : "Chalés e anexos"}
                                                    </p>
                                                    <p className="mt-1 text-lg font-semibold text-primary">{item.name}</p>
                                                </div>
                                                <p className="shrink-0 text-right text-xs text-foreground/70">
                                                    {referencePriceLabel(itemReference)}
                                                    <span className="block text-base font-bold text-primary">{formatBrl(itemReference.price)}</span>
                                                </p>
                                            </div>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </section>
            ) : null}
        </main>
    );
}
