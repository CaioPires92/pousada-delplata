'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import SearchWidget from '@/components/SearchWidget';
import { Check, AlertCircle, Wifi, Tv, Wind, Snowflake } from 'lucide-react';

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

function ReservarContent() {
    const searchParams = useSearchParams();
    const checkIn = searchParams.get('checkIn');
    const checkOut = searchParams.get('checkOut');
    const adults = searchParams.get('adults') || '2';
    const children = searchParams.get('children') || '0';

    const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
    const [guest, setGuest] = useState<Guest>({ name: '', email: '', phone: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (checkIn && checkOut) {
            fetchAvailability();
        }
    }, [checkIn, checkOut]);

    const fetchAvailability = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await fetch(
                `/api/availability?checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}&children=${children}`
            );

            if (!response.ok) throw new Error('Erro ao buscar disponibilidade');

            const data = await response.json();
            setAvailableRooms(data);
        } catch (err) {
            setError('Erro ao carregar quartos disponíveis. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectRoom = (room: Room) => {
        setSelectedRoom(room);
        // Scroll to form
        setTimeout(() => {
            document.getElementById('guest-form')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
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
            setProcessing(true);

            // 1. Criar a reserva
            const bookingResponse = await fetch('/api/bookings', {
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

            if (!bookingResponse.ok) {
                const errorData = await bookingResponse.json().catch(() => ({}));
                throw new Error(errorData.error || 'Erro ao criar reserva');
            }

            const booking = await bookingResponse.json();

            // 2. Criar preferência de pagamento no Mercado Pago
            const mpResponse = await fetch('/api/mercadopago/create-preference', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingId: booking.id }),
            });

            if (!mpResponse.ok) {
                const errorData = await mpResponse.json().catch(() => ({}));
                throw new Error(errorData.details || 'Erro ao gerar link de pagamento');
            }

            const { sandboxInitPoint, initPoint } = await mpResponse.json();
            const paymentUrl = initPoint || sandboxInitPoint;

            if (paymentUrl) {
                window.location.href = paymentUrl;
            } else {
                throw new Error('URL de pagamento não gerada');
            }

        } catch (err: any) {
            alert(err.message || 'Erro ao processar reserva. Tente novamente.');
            setProcessing(false);
        }
    };

    // Se não houver datas selecionadas, mostrar o SearchWidget
    if (!checkIn || !checkOut) {
        return (
            <main className="min-h-screen pt-24 pb-12 bg-background">
                <div className="container max-w-4xl mx-auto px-4">
                    <div className="text-center mb-12">
                        <h1 className="text-4xl font-bold font-heading mb-4">Faça sua Reserva</h1>
                        <p className="text-muted-foreground text-lg">Selecione as datas para verificar a disponibilidade</p>
                    </div>

                    <div className="bg-primary p-8 rounded-2xl shadow-xl">
                        <SearchWidget />
                    </div>
                </div>
            </main>
        );
    }

    if (loading) {
        return (
            <main className="min-h-screen pt-24 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="min-h-screen pt-24 container text-center">
                <div className="bg-destructive/10 text-destructive p-4 rounded-lg inline-flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
                <div className="mt-8">
                    <Button onClick={() => window.location.href = '/reservar'}>Tentar Novamente</Button>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen pt-24 pb-12 bg-background">
            <div className="container mx-auto px-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold font-heading">Acomodações Disponíveis</h1>
                        <p className="text-muted-foreground">
                            {new Date(checkIn!).toLocaleDateString('pt-BR')} - {new Date(checkOut!).toLocaleDateString('pt-BR')} • {adults} Adultos, {children} Crianças
                        </p>
                    </div>
                    <Button variant="outline" onClick={() => window.location.href = '/reservar'}>
                        Alterar Busca
                    </Button>
                </div>

                {!selectedRoom ? (
                    <div className="grid grid-cols-1 gap-8">
                        {availableRooms.length === 0 ? (
                            <div className="text-center py-12 bg-muted rounded-xl">
                                <p className="text-xl text-muted-foreground">Nenhum quarto disponível para as datas selecionadas.</p>
                                <Button className="mt-4" onClick={() => window.location.href = '/reservar'}>
                                    Buscar Outras Datas
                                </Button>
                            </div>
                        ) : (
                            availableRooms.map((room) => (
                                <Card key={room.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                                    <div className="grid md:grid-cols-3 gap-6">
                                        <div className="relative h-64 md:h-auto">
                                            {room.photos.length > 0 ? (
                                                <Image
                                                    src={room.photos[0].url}
                                                    alt={room.name}
                                                    fill
                                                    className="object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-muted flex items-center justify-center">
                                                    <span className="text-muted-foreground">Sem foto</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="col-span-2 p-6 flex flex-col justify-between">
                                            <div>
                                                <div className="flex justify-between items-start mb-4">
                                                    <h3 className="text-2xl font-bold font-heading">{room.name}</h3>
                                                    <div className="text-right">
                                                        <span className="text-sm text-muted-foreground">Total para o período</span>
                                                        <p className="text-2xl font-bold text-primary">R$ {room.totalPrice.toFixed(2)}</p>
                                                    </div>
                                                </div>
                                                <p className="text-muted-foreground mb-6">{room.description}</p>
                                                <div className="flex flex-wrap gap-3 mb-6">
                                                    {room.amenities.split(',').map((amenity, i) => (
                                                        <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-secondary/10 text-secondary-foreground rounded-full text-sm">
                                                            <Check className="w-3 h-3" /> {amenity.trim()}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <Button size="lg" onClick={() => handleSelectRoom(room)}>
                                                Selecionar Acomodação
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                ) : (
                    <div className="grid lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2">
                            <Card id="guest-form">
                                <CardHeader>
                                    <CardTitle>Dados da Reserva</CardTitle>
                                    <CardDescription>Preencha seus dados para finalizar a reserva</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <form onSubmit={handleSubmit} className="space-y-6">
                                        <div className="space-y-2">
                                            <label htmlFor="name" className="text-sm font-medium">Nome Completo *</label>
                                            <input
                                                type="text"
                                                id="name"
                                                required
                                                className="w-full px-4 py-2 rounded-md border border-input bg-background"
                                                value={guest.name}
                                                onChange={(e) => setGuest({ ...guest, name: e.target.value })}
                                                disabled={processing}
                                            />
                                        </div>
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label htmlFor="email" className="text-sm font-medium">Email *</label>
                                                <input
                                                    type="email"
                                                    id="email"
                                                    required
                                                    className="w-full px-4 py-2 rounded-md border border-input bg-background"
                                                    value={guest.email}
                                                    onChange={(e) => setGuest({ ...guest, email: e.target.value })}
                                                    disabled={processing}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label htmlFor="phone" className="text-sm font-medium">Telefone *</label>
                                                <input
                                                    type="tel"
                                                    id="phone"
                                                    required
                                                    className="w-full px-4 py-2 rounded-md border border-input bg-background"
                                                    value={guest.phone}
                                                    onChange={(e) => setGuest({ ...guest, phone: e.target.value })}
                                                    disabled={processing}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-3 pt-4 border-t">
                                            <input
                                                type="checkbox"
                                                id="terms"
                                                checked={termsAccepted}
                                                onChange={(e) => setTermsAccepted(e.target.checked)}
                                                disabled={processing}
                                                className="mt-1"
                                            />
                                            <label htmlFor="terms" className="text-sm text-muted-foreground">
                                                Li e aceito os termos e condições, políticas de cancelamento e privacidade do hotel.
                                            </label>
                                        </div>

                                        <Button type="submit" className="w-full" size="lg" disabled={processing}>
                                            {processing ? 'Processando...' : 'Ir para Pagamento'}
                                        </Button>
                                    </form>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="lg:col-span-1">
                            <Card className="sticky top-24">
                                <CardHeader>
                                    <CardTitle>Resumo da Reserva</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="aspect-video relative rounded-md overflow-hidden mb-4">
                                        {selectedRoom.photos.length > 0 && (
                                            <Image
                                                src={selectedRoom.photos[0].url}
                                                alt={selectedRoom.name}
                                                fill
                                                className="object-cover"
                                            />
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg">{selectedRoom.name}</h3>
                                        <p className="text-sm text-muted-foreground">{selectedRoom.description}</p>
                                    </div>
                                    <div className="border-t pt-4 space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span>Check-in:</span>
                                            <span className="font-medium">{new Date(checkIn!).toLocaleDateString('pt-BR')}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Check-out:</span>
                                            <span className="font-medium">{new Date(checkOut!).toLocaleDateString('pt-BR')}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Hóspedes:</span>
                                            <span className="font-medium">{adults} Adultos, {children} Crianças</span>
                                        </div>
                                    </div>
                                    <div className="border-t pt-4">
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold">Total:</span>
                                            <span className="text-2xl font-bold text-primary">R$ {selectedRoom.totalPrice.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <Button variant="outline" className="w-full mt-4" onClick={() => setSelectedRoom(null)}>
                                        Trocar Quarto
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}

export default function ReservarPage() {
    return (
        <Suspense fallback={
            <main className="min-h-screen pt-24 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </main>
        }>
            <ReservarContent />
        </Suspense>
    );
}
