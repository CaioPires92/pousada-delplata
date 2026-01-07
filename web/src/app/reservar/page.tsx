'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import SearchWidget from '@/components/SearchWidget';
import { Check, AlertCircle, Calendar, Users, ArrowLeft, CreditCard, User, Mail, Phone } from 'lucide-react';

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

    if (!checkIn || !checkOut) {
        return (
            <main className="min-h-screen relative flex items-center justify-center">
                {/* Background Image */}
                <div className="absolute inset-0 z-0">
                    <Image
                        src="/fotos/piscina-aptos/DJI_0845.jpg"
                        alt="Background"
                        fill
                        className="object-cover"
                        priority
                    />
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
                </div>

                <div className="container relative z-10 max-w-4xl mx-auto px-4">
                    <div className="text-center mb-8 text-white">
                        <h1 className="text-4xl md:text-5xl font-bold font-heading mb-4 drop-shadow-lg">
                            Planeje sua Estadia
                        </h1>
                        <p className="text-lg md:text-xl text-white/90 font-light drop-shadow-md max-w-2xl mx-auto">
                            Selecione as datas da sua viagem para conferir nossas acomodações exclusivas e garantir o melhor preço.
                        </p>
                    </div>

                    <div className="bg-white/95 backdrop-blur-sm p-6 md:p-8 rounded-2xl shadow-2xl border border-white/20">
                        <SearchWidget variant="light" />
                    </div>
                </div>
            </main>
        );
    }

    if (loading) {
        return (
            <main className="min-h-screen pt-32 flex flex-col items-center justify-center bg-muted/30">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mb-4"></div>
                <p className="text-muted-foreground text-lg animate-pulse">Buscando as melhores opções para você...</p>
            </main>
        );
    }

    if (error) {
        return (
            <main className="min-h-screen pt-32 container text-center bg-muted/30">
                <div className="bg-destructive/10 text-destructive p-6 rounded-xl inline-flex flex-col items-center gap-4 max-w-md mx-auto border border-destructive/20">
                    <AlertCircle className="w-12 h-12" />
                    <p className="text-lg font-medium">{error}</p>
                    <Button onClick={() => window.location.href = '/reservar'} variant="destructive">Tentar Novamente</Button>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen pt-28 pb-12 bg-muted/30">
            <div className="container mx-auto px-4">
                {/* Header da Busca */}
                <div className="bg-white rounded-xl shadow-sm border border-border/50 p-6 mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-primary/10 p-3 rounded-full text-primary">
                            <Calendar className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold font-heading text-primary">Disponibilidade</h1>
                            <p className="text-muted-foreground flex items-center gap-2 text-sm">
                                <span>{new Date(checkIn!).toLocaleDateString('pt-BR')} - {new Date(checkOut!).toLocaleDateString('pt-BR')}</span>
                                <span className="w-1 h-1 bg-muted-foreground rounded-full" />
                                <span>{adults} Adultos, {children} Crianças</span>
                            </p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={() => window.location.href = '/reservar'} className="gap-2">
                        <ArrowLeft className="w-4 h-4" /> Alterar Busca
                    </Button>
                </div>

                {!selectedRoom ? (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold font-heading text-primary pl-1">Escolha sua Acomodação</h2>

                        {availableRooms.length === 0 ? (
                            <div className="text-center py-16 bg-white rounded-xl border border-dashed border-border">
                                <p className="text-xl text-muted-foreground mb-4">Nenhum quarto disponível para as datas selecionadas.</p>
                                <Button onClick={() => window.location.href = '/reservar'}>
                                    Buscar Outras Datas
                                </Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-6">
                                {availableRooms.map((room) => (
                                    <Card key={room.id} className="overflow-hidden hover:shadow-xl transition-all duration-300 border-border/50 group">
                                        <div className="grid md:grid-cols-12 gap-0">
                                            <div className="md:col-span-4 relative h-64 md:h-auto overflow-hidden">
                                                {room.photos.length > 0 ? (
                                                    <Image
                                                        src={room.photos[0].url}
                                                        alt={room.name}
                                                        fill
                                                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full bg-muted flex items-center justify-center">
                                                        <span className="text-muted-foreground">Sem foto</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="md:col-span-8 p-6 flex flex-col justify-between">
                                                <div>
                                                    <div className="flex justify-between items-start mb-2">
                                                        <h3 className="text-2xl font-bold font-heading text-primary">{room.name}</h3>
                                                        <div className="text-right hidden md:block">
                                                            <span className="text-xs text-muted-foreground uppercase tracking-wider">Total da estadia</span>
                                                            <p className="text-2xl font-bold text-primary">R$ {room.totalPrice.toFixed(2)}</p>
                                                        </div>
                                                    </div>
                                                    <p className="text-muted-foreground mb-4" style={{ whiteSpace: 'pre-line' }}>{room.description}</p>

                                                    <div className="flex flex-wrap gap-2 mb-6">
                                                        {room.amenities.split(',').map((amenity, i) => (
                                                            <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 bg-secondary/10 text-secondary-foreground rounded-full text-xs font-medium border border-secondary/20">
                                                                <Check className="w-3 h-3" /> {amenity.trim()}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between mt-4 border-t pt-4">
                                                    <div className="md:hidden">
                                                        <span className="text-xs text-muted-foreground">Total</span>
                                                        <p className="text-xl font-bold text-primary">R$ {room.totalPrice.toFixed(2)}</p>
                                                    </div>
                                                    <Button size="lg" onClick={() => handleSelectRoom(room)} className="ml-auto w-full md:w-auto shadow-lg shadow-primary/20">
                                                        Selecionar e Continuar
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="grid lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="lg:col-span-2 space-y-6">
                            <Button variant="ghost" onClick={() => setSelectedRoom(null)} className="pl-0 hover:pl-2 transition-all gap-2 text-muted-foreground">
                                <ArrowLeft className="w-4 h-4" /> Voltar para seleção de quartos
                            </Button>

                            <Card id="guest-form" className="border-border/50 shadow-md">
                                <CardHeader className="bg-muted/30 border-b border-border/50 pb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-primary/10 p-2 rounded-lg text-primary">
                                            <User className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-xl">Dados do Hóspede Principal</CardTitle>
                                            <CardDescription>Informações para contato e voucher</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    <form onSubmit={handleSubmit} className="space-y-6">
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label htmlFor="name" className="text-sm font-medium flex items-center gap-2">
                                                    <User className="w-4 h-4 text-muted-foreground" /> Nome Completo *
                                                </label>
                                                <input
                                                    type="text"
                                                    id="name"
                                                    required
                                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                    placeholder="Digite seu nome completo"
                                                    value={guest.name}
                                                    onChange={(e) => setGuest({ ...guest, name: e.target.value })}
                                                    disabled={processing}
                                                />
                                            </div>
                                            <div className="grid md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
                                                        <Mail className="w-4 h-4 text-muted-foreground" /> Email *
                                                    </label>
                                                    <input
                                                        type="email"
                                                        id="email"
                                                        required
                                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                        placeholder="seu@email.com"
                                                        value={guest.email}
                                                        onChange={(e) => setGuest({ ...guest, email: e.target.value })}
                                                        disabled={processing}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label htmlFor="phone" className="text-sm font-medium flex items-center gap-2">
                                                        <Phone className="w-4 h-4 text-muted-foreground" /> Telefone/WhatsApp *
                                                    </label>
                                                    <input
                                                        type="tel"
                                                        id="phone"
                                                        required
                                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                        placeholder="(00) 00000-0000"
                                                        value={guest.phone}
                                                        onChange={(e) => setGuest({ ...guest, phone: e.target.value })}
                                                        disabled={processing}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-secondary/5 p-4 rounded-lg border border-secondary/20">
                                            <div className="flex items-start gap-3">
                                                <input
                                                    type="checkbox"
                                                    id="terms"
                                                    checked={termsAccepted}
                                                    onChange={(e) => setTermsAccepted(e.target.checked)}
                                                    disabled={processing}
                                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                />
                                                <label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer">
                                                    Declaro que li e aceito os <span className="text-primary font-medium hover:underline">termos e condições</span>, políticas de cancelamento e privacidade da Pousada Delplata.
                                                </label>
                                            </div>
                                        </div>

                                        <Button type="submit" className="w-full h-12 text-lg shadow-lg shadow-primary/20" size="lg" disabled={processing}>
                                            {processing ? (
                                                <span className="flex items-center gap-2">
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                    Processando...
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-2">
                                                    <CreditCard className="w-5 h-5" /> Ir para Pagamento Seguro
                                                </span>
                                            )}
                                        </Button>

                                        <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                                            <span className="w-2 h-2 bg-green-500 rounded-full"></span> Ambiente seguro e criptografado
                                        </p>
                                    </form>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="lg:col-span-1">
                            <Card className="sticky top-28 border-border/50 shadow-md overflow-hidden">
                                <div className="bg-primary p-4 text-white text-center">
                                    <h3 className="font-bold text-lg">Resumo da Reserva</h3>
                                </div>
                                <div className="aspect-video relative">
                                    {selectedRoom.photos.length > 0 && (
                                        <Image
                                            src={selectedRoom.photos[0].url}
                                            alt={selectedRoom.name}
                                            fill
                                            className="object-cover"
                                        />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                                        <h3 className="font-bold text-white text-lg shadow-sm">{selectedRoom.name}</h3>
                                    </div>
                                </div>
                                <CardContent className="space-y-4 pt-6">
                                    <div className="space-y-3 text-sm">
                                        <div className="flex justify-between items-center py-2 border-b border-border/50">
                                            <span className="text-muted-foreground">Check-in</span>
                                            <span className="font-medium">{new Date(checkIn!).toLocaleDateString('pt-BR')}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b border-border/50">
                                            <span className="text-muted-foreground">Check-out</span>
                                            <span className="font-medium">{new Date(checkOut!).toLocaleDateString('pt-BR')}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b border-border/50">
                                            <span className="text-muted-foreground">Hóspedes</span>
                                            <span className="font-medium">{adults} Adultos, {children} Crianças</span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b border-border/50">
                                            <span className="text-muted-foreground">Diárias</span>
                                            <span className="font-medium">
                                                {Math.ceil((new Date(checkOut!).getTime() - new Date(checkIn!).getTime()) / (1000 * 60 * 60 * 24))} noites
                                            </span>
                                        </div>
                                    </div>

                                    <div className="bg-muted/30 p-4 rounded-lg mt-4">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-sm text-muted-foreground">Valor Total</span>
                                            <span className="text-2xl font-bold text-primary">R$ {selectedRoom.totalPrice.toFixed(2)}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground text-right">Taxas e impostos inclusos</p>
                                    </div>

                                    <Button variant="outline" className="w-full border-dashed" onClick={() => setSelectedRoom(null)}>
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
            <main className="min-h-screen pt-24 flex items-center justify-center bg-muted/30">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </main>
        }>
            <ReservarContent />
        </Suspense>
    );
}
