import Link from "next/link";
import prisma from "@/lib/prisma";
import styles from "./rooms.module.css";

// Force dynamic rendering to fetch fresh data
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

    return (
        <main className="container section">
            <h1 className={styles.title}>Nossas Acomodações</h1>
            <p className={styles.subtitle}>Escolha o quarto perfeito para sua estadia.</p>

            <div className={styles.grid}>
                {rooms.map((room) => (
                    <div key={room.id} className={styles.card}>
                        <div className={styles.imageContainer}>
                            {room.photos.length > 0 ? (
                                <img src={room.photos[0].url} alt={room.name} className={styles.image} />
                            ) : (
                                <div className={styles.placeholderImage}>Sem Foto</div>
                            )}
                        </div>
                        <div className={styles.content}>
                            <h2>{room.name}</h2>
                            <p className={styles.description}>{room.description}</p>
                            <div className={styles.details}>
                                <span>Capacidade: {room.capacity} pessoas</span>
                                <span className={styles.price}>A partir de R$ {Number(room.basePrice).toFixed(2)}</span>
                            </div>
                            <Link href={`/acomodacoes/${room.id}`} className="btn-primary">
                                Ver Detalhes
                            </Link>
                        </div>
                    </div>
                ))}

                {rooms.length === 0 && (
                    <p>Nenhuma acomodação encontrada no momento.</p>
                )}
            </div>
        </main>
    );
}
