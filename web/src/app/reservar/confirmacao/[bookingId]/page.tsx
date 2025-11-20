import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import styles from './confirmacao.module.css';

export const dynamic = 'force-dynamic';

async function getBooking(id: string) {
    const booking = await prisma.booking.findUnique({
        where: { id },
        include: {
            roomType: true,
            guest: true,
            payment: true,
        },
    });
    return booking;
}

export default async function ConfirmacaoPage({
    params,
    searchParams,
}: {
    params: Promise<{ bookingId: string }>;
    searchParams: Promise<{ status?: string }>;
}) {
    const { bookingId } = await params;
    const { status } = await searchParams;

    const booking = await getBooking(bookingId);

    if (!booking) {
        notFound();
    }

    const statusMessages = {
        approved: {
            title: '✅ Pagamento Aprovado!',
            message: 'Sua reserva foi confirmada com sucesso.',
            color: '#4caf50',
        },
        pending: {
            title: '⏳ Pagamento Pendente',
            message: 'Aguardando confirmação do pagamento.',
            color: '#ff9800',
        },
        rejected: {
            title: '❌ Pagamento Recusado',
            message: 'Não foi possível processar o pagamento. Tente novamente.',
            color: '#f44336',
        },
        default: {
            title: '📋 Detalhes da Reserva',
            message: 'Reserva criada. Aguardando pagamento.',
            color: '#2196f3',
        },
    };

    const currentStatus = statusMessages[status as keyof typeof statusMessages] || statusMessages.default;

    return (
        <main className="container section">
            <div className={styles.confirmation} style={{ borderColor: currentStatus.color }}>
                <h1 style={{ color: currentStatus.color }}>{currentStatus.title}</h1>
                <p className={styles.message}>{currentStatus.message}</p>

                <div className={styles.bookingDetails}>
                    <h2>Detalhes da Reserva</h2>

                    <div className={styles.detail}>
                        <strong>Número da Reserva:</strong>
                        <span>{booking.id.slice(0, 8).toUpperCase()}</span>
                    </div>

                    <div className={styles.detail}>
                        <strong>Quarto:</strong>
                        <span>{booking.roomType.name}</span>
                    </div>

                    <div className={styles.detail}>
                        <strong>Hóspede:</strong>
                        <span>{booking.guest.name}</span>
                    </div>

                    <div className={styles.detail}>
                        <strong>Email:</strong>
                        <span>{booking.guest.email}</span>
                    </div>

                    <div className={styles.detail}>
                        <strong>Check-in:</strong>
                        <span>{new Date(booking.checkIn).toLocaleDateString('pt-BR')}</span>
                    </div>

                    <div className={styles.detail}>
                        <strong>Check-out:</strong>
                        <span>{new Date(booking.checkOut).toLocaleDateString('pt-BR')}</span>
                    </div>

                    <div className={styles.detail}>
                        <strong>Total:</strong>
                        <span className={styles.total}>R$ {Number(booking.totalPrice).toFixed(2)}</span>
                    </div>

                    <div className={styles.detail}>
                        <strong>Status:</strong>
                        <span className={styles.status} style={{ color: currentStatus.color }}>
                            {booking.status === 'CONFIRMED' ? 'Confirmada' :
                                booking.status === 'CANCELLED' ? 'Cancelada' : 'Pendente'}
                        </span>
                    </div>
                </div>

                {booking.status === 'CONFIRMED' && (
                    <div className={styles.instructions}>
                        <h3>Instruções de Check-in</h3>
                        <p>• Check-in: A partir das 14h</p>
                        <p>• Check-out: Até às 12h</p>
                        <p>• Apresente este número de reserva na recepção: <strong>{booking.id.slice(0, 8).toUpperCase()}</strong></p>
                        <p>• Em caso de dúvidas, entre em contato: (XX) XXXX-XXXX</p>
                    </div>
                )}

                <div className={styles.actions}>
                    <a href="/" className="btn-primary">Voltar para Home</a>
                </div>
            </div>
        </main>
    );
}
