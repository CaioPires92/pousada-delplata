'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './quartos.module.css';

interface RoomType {
    id: string;
    name: string;
    description: string;
    capacity: number;
    totalUnits: number;
    basePrice: number;
    amenities: string;
    photos: { url: string }[];
}

export default function AdminQuartosPage() {
    const router = useRouter();
    const [rooms, setRooms] = useState<RoomType[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingRoom, setEditingRoom] = useState<RoomType | null>(null);

    useEffect(() => {
        const token = localStorage.getItem('admin_token');
        if (!token) {
            router.push('/admin/login');
            return;
        }

        fetchRooms();
    }, [router]);

    const fetchRooms = async () => {
        try {
            const response = await fetch('/api/admin/rooms');
            if (!response.ok) throw new Error('Erro ao carregar quartos');

            const data = await response.json();
            setRooms(data);
        } catch (error) {
            console.error('Erro:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_name');
        router.push('/admin/login');
    };

    const handleEdit = (room: RoomType) => {
        setEditingRoom(room);
    };

    const handleSave = async () => {
        if (!editingRoom) return;

        try {
            const response = await fetch(`/api/admin/rooms/${editingRoom.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingRoom)
            });

            if (!response.ok) throw new Error('Erro ao salvar');

            await fetchRooms();
            setEditingRoom(null);
            alert('Quarto atualizado com sucesso!');
        } catch (error) {
            alert('Erro ao salvar quarto');
        }
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>Carregando...</div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <h1>🏨 Painel Administrativo</h1>
                    <button onClick={handleLogout} className={styles.logoutButton}>
                        Sair
                    </button>
                </div>
            </header>

            <nav className={styles.nav}>
                <a href="/admin/dashboard" className={styles.navItem}>
                    📊 Dashboard
                </a>
                <a href="/admin/reservas" className={styles.navItem}>
                    📋 Reservas
                </a>
                <a href="/admin/quartos" className={styles.navItemActive}>
                    🏠 Quartos
                </a>
                <a href="/" className={styles.navItem} target="_blank">
                    🌐 Ver Site
                </a>
            </nav>

            <main className={styles.main}>
                <div className={styles.pageHeader}>
                    <h2>Gerenciar Quartos ({rooms.length})</h2>
                </div>

                <div className={styles.roomsGrid}>
                    {rooms.map((room) => (
                        <div key={room.id} className={styles.roomCard}>
                            <div className={styles.roomHeader}>
                                <h3>{room.name}</h3>
                                <button
                                    onClick={() => handleEdit(room)}
                                    className={styles.editButton}
                                >
                                    ✏️ Editar
                                </button>
                            </div>

                            <div className={styles.roomDetails}>
                                <p className={styles.description}>{room.description}</p>

                                <div className={styles.specs}>
                                    <div className={styles.spec}>
                                        <span className={styles.specLabel}>Capacidade:</span>
                                        <span className={styles.specValue}>{room.capacity} pessoas</span>
                                    </div>
                                    <div className={styles.spec}>
                                        <span className={styles.specLabel}>Unidades:</span>
                                        <span className={styles.specValue}>{room.totalUnits}</span>
                                    </div>
                                    <div className={styles.spec}>
                                        <span className={styles.specLabel}>Preço Base:</span>
                                        <span className={styles.specValue}>
                                            R$ {Number(room.basePrice).toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                <div className={styles.amenities}>
                                    <strong>Comodidades:</strong>
                                    <p>{room.amenities}</p>
                                </div>

                                {room.photos.length > 0 && (
                                    <div className={styles.photos}>
                                        <strong>Fotos: {room.photos.length}</strong>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            {editingRoom && (
                <div className={styles.modal}>
                    <div className={styles.modalContent}>
                        <h2>Editar Quarto</h2>

                        <div className={styles.formField}>
                            <label>Nome:</label>
                            <input
                                type="text"
                                value={editingRoom.name}
                                onChange={(e) => setEditingRoom({
                                    ...editingRoom,
                                    name: e.target.value
                                })}
                            />
                        </div>

                        <div className={styles.formField}>
                            <label>Descrição:</label>
                            <textarea
                                value={editingRoom.description}
                                onChange={(e) => setEditingRoom({
                                    ...editingRoom,
                                    description: e.target.value
                                })}
                                rows={3}
                            />
                        </div>

                        <div className={styles.formRow}>
                            <div className={styles.formField}>
                                <label>Capacidade:</label>
                                <input
                                    type="number"
                                    value={editingRoom.capacity}
                                    onChange={(e) => setEditingRoom({
                                        ...editingRoom,
                                        capacity: parseInt(e.target.value)
                                    })}
                                />
                            </div>

                            <div className={styles.formField}>
                                <label>Unidades:</label>
                                <input
                                    type="number"
                                    value={editingRoom.totalUnits}
                                    onChange={(e) => setEditingRoom({
                                        ...editingRoom,
                                        totalUnits: parseInt(e.target.value)
                                    })}
                                />
                            </div>

                            <div className={styles.formField}>
                                <label>Preço (R$):</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={editingRoom.basePrice}
                                    onChange={(e) => setEditingRoom({
                                        ...editingRoom,
                                        basePrice: parseFloat(e.target.value)
                                    })}
                                />
                            </div>
                        </div>

                        <div className={styles.formField}>
                            <label>Comodidades:</label>
                            <textarea
                                value={editingRoom.amenities}
                                onChange={(e) => setEditingRoom({
                                    ...editingRoom,
                                    amenities: e.target.value
                                })}
                                rows={2}
                            />
                        </div>

                        <div className={styles.modalActions}>
                            <button onClick={() => setEditingRoom(null)} className={styles.cancelButton}>
                                Cancelar
                            </button>
                            <button onClick={handleSave} className={styles.saveButton}>
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
