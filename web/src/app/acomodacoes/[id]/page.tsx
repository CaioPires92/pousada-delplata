import Link from "next/link";
import Image from "next/image";
import prisma from "@/lib/prisma";
import { getRoomDisplayDescription } from "@/lib/room-description";
import { serializePrismaEntity } from "@/lib/serialize-prisma";
import { notFound } from "next/navigation";
import styles from "./room-details.module.css";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

async function getRoom(id: string) {
    const room = await prisma.roomType.findUnique({
        where: { id },
        include: {
            photos: true,
        },
    });

    // Serialize Prisma data (Decimal → number, Date → ISO string)
    return room ? serializePrismaEntity(room) : null;
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
                        {room.photos.slice(1).map((photo) => (
                            <Image
                                key={photo.id}
                                src={photo.url}
                                alt=""
                                className={styles.thumbnail}
                                width={240}
                                height={160}
                                sizes="(max-width: 768px) 33vw, 240px"
                            />
                        ))}
                    </div>
                </div>

                <div className={styles.info}>
                    <div className={styles.priceCard}>
                        <span className={styles.priceLabel}>Diárias a partir de</span>
                        <span className={styles.price}>R$ {room.basePrice.toFixed(2)}</span>
                        <Link href={`/reservar?roomTypeId=${room.id}`} className="btn-primary" style={{ display: 'block', textAlign: 'center', marginTop: '1rem' }}>
                            Reservar Agora
                        </Link>
                    </div>

                    <div className={styles.description}>
                        <h3>Sobre a acomodação</h3>
                        <div
                            dangerouslySetInnerHTML={{
                                __html: getRoomDisplayDescription(room.name, room.description).replace(/\n/g, '<br />'),
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
