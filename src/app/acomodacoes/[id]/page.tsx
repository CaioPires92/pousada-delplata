import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { cache } from "react";

import prisma from "@/lib/prisma";
import { serializePrismaEntity } from "@/lib/serialize-prisma";
import { notFound } from "next/navigation";
import styles from "./room-details.module.css";
import { buildPageMetadata, stripHtml } from "@/lib/seo";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

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

    return (
        <main className="container section">
            <div className={styles.header}>
                <Link href="/acomodacoes" className={styles.backLink}>
                    &larr; Voltar para Acomodações
                </Link>
                <h1 className={styles.title}>{room.name}</h1>
            </div>

            <div className={styles.grid}>
                <div className={styles.gallery}>
                    {room.photos.length > 0 ? (
                        <div className={styles.mainImageContainer}>
                            <Image
                                src={room.photos[0].url}
                                alt={room.name}
                                className={styles.mainImage}
                                width={1200}
                                height={800}
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1200px"
                                priority
                            />
                        </div>
                    ) : (
                        <div className={styles.placeholderImage}>Sem Foto</div>
                    )}
                    <div className={styles.thumbnails}>
                        {room.photos.slice(1).map((photo, index) => (
                            <Image
                                key={photo.id}
                                src={photo.url}
                                alt={`${room.name} - foto ${index + 2}`}
                                className={styles.thumbnail}
                                width={240}
                                height={160}
                                sizes="(max-width: 768px) 33vw, 240px"
                            />
                        ))}
                    </div>
                </div>

                <div className={styles.info}>
                    <div className={styles.availabilityCard}>
                        <p className={styles.availabilityCopy}>
                            Valores variam conforme data e ocupação. Consulte disponibilidade.
                        </p>
                        <Link href={`/reservar?roomTypeId=${room.id}`} className={styles.availabilityButton}>
                            Ver disponibilidade e preços
                        </Link>
                    </div>

                    <div className={styles.description}>
                        <h3>Sobre a acomodação</h3>
                        <div
                            dangerouslySetInnerHTML={{
                                __html: (room.description ?? '').replace(/\n/g, '<br />'),
                            }}
                        />
                    </div>

                    <div className={styles.amenities}>
                        <h3>Comodidades</h3>
                        <ul>
                            {/* Assuming amenities is a comma-separated string for now as per schema comment */}
                            {room.amenities.split(',').map((amenity, index) => (
                                <li key={index}>{amenity.trim()}</li>
                            ))}
                        </ul>
                    </div>

                    <div className={styles.capacity}>
                        <h3>Capacidade</h3>
                        <p>Até {room.capacity} pessoas</p>
                    </div>
                </div>
            </div>
        </main>
    );
}
