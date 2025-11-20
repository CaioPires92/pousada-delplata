'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './reservar.module.css';

interface Room {
    id: string;
    name: string;
    description: string;
    capacity: number;
    amenities: string;
    totalPrice: number;
    photos: { url: string }[];
}

interface Guest {
    name: string;
    email: string;
    phone: string;
}

export default function ReservarPage() {
    const searchParams = useSearchParams();
    const checkIn = searchParams.get('checkIn');
    const checkOut = searchParams.get('checkOut');
    const adults = searchParams.get('adults') || '2';
    const children = searchParams.get('children') || '0';

    const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
    const [guest, setGuest] = useState<Guest>({ name: '', email: '', phone: '' });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [termsAccepted, setTermsAccepted] = useState(false);

    useEffect(() => {
        if (checkIn && checkOut) {
            fetchAvailability();
        } else {
            setError('Por favor, selecione as datas de check-in e check-out.');
            setLoading(false);
        }
    }, [checkIn, checkOut]);

    const fetchAvailability = async () => {
        try {
            setLoading(true);
            const response = await fetch(
                `/api/availability?checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}&children=${children}`
            );

            if (!response.ok) throw new Error('Erro ao buscar disponibilidade');

            const data = await response.json();
            setAvailableRooms(data);
            setLoading(false);
        } catch (err) {
            setError('Erro ao carregar quartos disponíveis. Tente novamente.');
            setLoading(false);
        }
    };

    const handleSelectRoom = (room: Room) => {
        setSelectedRoom(room);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedRoom) {
            alert('Por favor, selecione um quarto.');
            return;
        }

        if (!termsAccepted) {
            alert('Por favor, aceite os termos e condições.');
            return;
        }

        try {
            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomTypeId: selectedRoom.id,
                    checkIn,
                    checkOut,
                    totalPrice: selectedRoom.totalPrice,
                    guest,
                }),
            });

            if (!response.ok) throw new Error('Erro ao criar reserva');

            const booking = await response.json();

            // Redirecionar para página de pagamento (Mercado Pago será integrado depois)
            alert(`Reserva criada com sucesso! ID: ${booking.id}\n\nAguarde integração com Mercado Pago...`);

        } catch (err) {
            alert('Erro ao criar reserva. Tente novamente.');
        }
    };

    if (loading) {
        return (
            <main className="container section">
                <div className={styles.loading}>Carregando quartos disponíveis...</div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="container section">
                <div className={styles.error}>{error}</div>
            </main>
        );
    }

    return (
        <main className="container section">
            <h1>Reservar Acomodação</h1>

            <div className={styles.searchInfo}>
                <p><strong>Check-in:</strong> {new Date(checkIn!).toLocaleDateString('pt-BR')}</p>
                <p><strong>Check-out:</strong> {new Date(checkOut!).toLocaleDateString('pt-BR')}</p>
                <p><strong>Hóspedes:</strong> {adults} adulto(s), {children} criança(s)</p>
            </div>

            {!selectedRoom ? (
                <>
                    <h2>Quartos Disponíveis</h2>
                    {availableRooms.length === 0 ? (
                        <p className={styles.noRooms}>Nenhum quarto disponível para as datas selecionadas.</p>
                    ) : (
                        <div className={styles.roomsList}>
                            {availableRooms.map((room) => (
                                <div key={room.id} className={styles.roomCard}>
                                    <div className={styles.roomImage}>
                                        {room.photos.length > 0 ? (
                                            <img src={room.photos[0].url} alt={room.name} />
                                        ) : (
                                            <div className={styles.noImage}>Sem foto</div>
                                        )}
                                    </div>
                                    <div className={styles.roomInfo}>
                                        <h3>{room.name}</h3>
                                        <p className={styles.description}>{room.description}</p>
                                        <div className={styles.amenities}>
                                            {room.amenities.split(',').map((amenity, i) => (
                                                <span key={i} className={styles.amenity}>{amenity.trim()}</span>
                                            ))}
                                        </div>
                                        <div className={styles.roomFooter}>
                                            <div className={styles.price}>
                                                <span className={styles.priceLabel}>Total:</span>
                                                <span className={styles.priceValue}>R$ {room.totalPrice.toFixed(2)}</span>
                                            </div>
                                            <button
                                                onClick={() => handleSelectRoom(room)}
                                                className="btn-primary"
                                            >
                                                Selecionar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                <>
                    <h2>Confirmar Reserva</h2>

                    <div className={styles.selectedRoom}>
                        <h3>{selectedRoom.name}</h3>
                        <p>Total: R$ {selectedRoom.totalPrice.toFixed(2)}</p>
                        <button onClick={() => setSelectedRoom(null)} className="btn-secondary">
                            Trocar quarto
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className={styles.checkoutForm}>
                        <h3>Seus Dados</h3>

                        <div className={styles.formField}>
                            <label htmlFor="name">Nome Completo *</label>
                            <input
                                type="text"
                                id="name"
                                required
                                value={guest.name}
                                onChange={(e) => setGuest({ ...guest, name: e.target.value })}
                            />
                        </div>

                        <div className={styles.formField}>
                            <label htmlFor="email">Email *</label>
                            <input
                                type="email"
                                id="email"
                                required
                                value={guest.email}
                                onChange={(e) => setGuest({ ...guest, email: e.target.value })}
                            />
                        </div>

                        <div className={styles.formField}>
                            <label htmlFor="phone">Telefone *</label>
                            <input
                                type="tel"
                                id="phone"
                                required
                                value={guest.phone}
                                onChange={(e) => setGuest({ ...guest, phone: e.target.value })}
                            />
                        </div>

                        <div className={styles.formField}>
                            <label className={styles.checkbox}>
                                <input
                                    type="checkbox"
                                    checked={termsAccepted}
                                    onChange={(e) => setTermsAccepted(e.target.checked)}
                                />
                                <span>Aceito os termos e condições e políticas de privacidade</span>
                            </label>
                        </div>

                        <button type="submit" className="btn-primary" style={{ width: '100%', padding: '1rem' }}>
                            Finalizar Reserva
                        </button>
                    </form>
                </>
            )}
        </main>
    );
}
