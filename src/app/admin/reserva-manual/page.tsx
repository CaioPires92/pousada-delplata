'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../reservas/reservas.module.css';

interface RoomType {
    id: string;
    name: string;
}

export default function ReservaManualPage() {
    const router = useRouter();
    const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
    const [loading, setLoading] = useState(false);
    const [roomsLoading, setRoomsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        guestName: '',
        guestEmail: '',
        guestPhone: '',
        checkIn: '',
        checkOut: '',
        roomTypeId: '',
        totalPrice: '',
        adults: '2',
        children: '0'
    });

    useEffect(() => {
        async function fetchRooms() {
            try {
                const res = await fetch('/api/rooms');
                if (!res.ok) throw new Error('Erro ao buscar tipos de quarto');
                const data = await res.json();
                setRoomTypes(data);
                if (data.length > 0) {
                    setFormData(prev => ({ ...prev, roomTypeId: data[0].id }));
                }
            } catch (err) {
                console.error(err);
                setError('Falha ao carregar quartos. Por favor, recarregue a página.');
            } finally {
                setRoomsLoading(false);
            }
        }
        fetchRooms();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Basic number validation
        const price = Number(formData.totalPrice);
        if (isNaN(price) || price <= 0) {
            setError('Por favor, insira um valor total válido (maior que zero).');
            return;
        }

        const adults = Number(formData.adults);
        if (isNaN(adults) || adults < 1) {
            setError('É necessário pelo menos 1 adulto.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/admin/manual-booking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            // Se for 500, tentar pegar os detalhes enviados pelo logger aprimorado
            const data = await res.json().catch(() => ({ error: 'Erro de resposta do servidor' }));

            if (!res.ok) {
                const detailedError = data.details ? `${data.error}: ${data.details}` : data.error;
                throw new Error(detailedError || 'Erro ao criar reserva manual');
            }

            // Redirecionar para o checkout do Mercado Pago
            if (data.initPoint) {
                window.location.href = data.initPoint;
            } else {
                router.push('/admin/reservas');
            }
        } catch (err: any) {
            console.error('Frontend Error:', err);
            setError(err.message);
            setLoading(false);
        }
    };

    if (roomsLoading) {
        return <div className={styles.loading}>Carregando formulário...</div>;
    }

    return (
        <div className={styles.wrapper}>
            <header className={styles.stickyHeader}>
                <div className={styles.headerTitleRow}>
                    <h2 className={styles.pageTitle}>Nova Reserva Manual</h2>
                </div>
            </header>

            <div className="max-w-[800px] mx-auto mt-8 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Seção Hóspede */}
                        <div className="space-y-4 col-span-2">
                            <h3 className="text-lg font-semibold border-b pb-2 text-slate-800">Dados do Hóspede</h3>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-700">Nome Completo</label>
                                <input
                                    required
                                    type="text"
                                    name="guestName"
                                    value={formData.guestName}
                                    onChange={handleChange}
                                    className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Ex: João Silva"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-700">Email</label>
                                    <input
                                        required
                                        type="email"
                                        name="guestEmail"
                                        value={formData.guestEmail}
                                        onChange={handleChange}
                                        className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="email@exemplo.com"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-700">Telefone</label>
                                    <input
                                        type="tel"
                                        name="guestPhone"
                                        value={formData.guestPhone}
                                        onChange={handleChange}
                                        className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="(11) 99999-9999"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Seção Estadia */}
                        <div className="space-y-4 col-span-2 mt-4">
                            <h3 className="text-lg font-semibold border-b pb-2 text-slate-800">Detalhes da Estadia</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-700">Check-in</label>
                                    <input
                                        required
                                        type="date"
                                        name="checkIn"
                                        value={formData.checkIn}
                                        onChange={handleChange}
                                        className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-700">Check-out</label>
                                    <input
                                        required
                                        type="date"
                                        name="checkOut"
                                        value={formData.checkOut}
                                        onChange={handleChange}
                                        className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-700">Tipo de Quarto</label>
                                <select
                                    required
                                    name="roomTypeId"
                                    value={formData.roomTypeId}
                                    onChange={handleChange}
                                    className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                >
                                    {roomTypes.map(room => (
                                        <option key={room.id} value={room.id}>{room.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-700">Adultos</label>
                                    <input
                                        required
                                        type="number"
                                        min="1"
                                        name="adults"
                                        value={formData.adults}
                                        onChange={handleChange}
                                        className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-700">Crianças</label>
                                    <input
                                        required
                                        type="number"
                                        min="0"
                                        name="children"
                                        value={formData.children}
                                        onChange={handleChange}
                                        className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Seção Financeira */}
                        <div className="space-y-4 col-span-2 mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <h3 className="text-lg font-semibold text-slate-800">Financeiro</h3>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-700">Valor Total da Reserva (R$)</label>
                                <input
                                    required
                                    type="number"
                                    step="0.01"
                                    min="1"
                                    name="totalPrice"
                                    value={formData.totalPrice}
                                    onChange={handleChange}
                                    className="w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-green-500 outline-none text-xl font-bold text-green-700"
                                    placeholder="0,00"
                                />
                                <p className="text-xs text-slate-500">Este valor será enviado exatamente ao Mercado Pago para cobrança.</p>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t flex justify-end">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="mr-4 px-6 py-2 text-slate-600 hover:text-slate-800 font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold shadow-lg hover:bg-blue-700 transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {loading ? 'Processando...' : 'Gerar Reserva e Pagar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
