'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './quartos.module.css';

interface RoomType {
    id: string;
    name: string;
    description: string;
    capacity: number;
    totalUnits: number;
    inventoryFor4Guests: number;
    basePrice: number;
    amenities: string;
    photos: { url: string }[];
}

export default function AdminQuartosPage() {
    const router = useRouter();
    const [rooms, setRooms] = useState<RoomType[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingRoom, setEditingRoom] = useState<RoomType | null>(null);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [creatingRoom, setCreatingRoom] = useState({
        name: 'Apartamento Anexo',
        description: '',
        capacity: 3,
        totalUnits: 2,
        inventoryFor4Guests: 0,
        basePrice: 499,
        amenities: '',
        photosText: '',
    });
    const [batchModalOpen, setBatchModalOpen] = useState(false);
    const [batchData, setBatchData] = useState({
        roomTypeId: 'all',
        totalUnits: '',
        inventoryFor4Guests: '',
        basePrice: '',
        capacity: ''
    });

    const fetchRooms = useCallback(async () => {
        try {
            const response = await fetch('/api/admin/rooms');
            if (response.status === 401) {
                router.push('/admin/login');
                return;
            }
            if (!response.ok) throw new Error('Erro ao carregar quartos');

            const data = await response.json();
            setRooms(Array.isArray(data)
                ? data.map((room) => ({
                    ...room,
                    inventoryFor4Guests: Number(room.inventoryFor4Guests ?? 0),
                }))
                : []);
        } catch (error) {
            console.error('Erro:', error);
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        fetchRooms();
    }, [fetchRooms]);

    const handleEdit = (room: RoomType) => {
        setEditingRoom({
            ...room,
            inventoryFor4Guests: Number(room.inventoryFor4Guests ?? 0),
        });
    };

    const handleSave = async () => {
        if (!editingRoom) return;
        if (editingRoom.inventoryFor4Guests < 0 || editingRoom.inventoryFor4Guests > editingRoom.totalUnits) {
            alert('O subinventário para 4 hóspedes deve ficar entre 0 e o total de unidades.');
            return;
        }

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
        } catch {
            alert('Erro ao salvar quarto');
        }
    };

    const handleBatchSave = async () => {
        const totalUnitsValue = batchData.totalUnits === '' ? undefined : parseInt(batchData.totalUnits);
        const inventoryFor4GuestsValue = batchData.inventoryFor4Guests === '' ? undefined : parseInt(batchData.inventoryFor4Guests);
        const basePriceValue = batchData.basePrice === '' ? undefined : Number(batchData.basePrice);
        const capacityValue = batchData.capacity === '' ? undefined : parseInt(batchData.capacity);

        if (totalUnitsValue !== undefined && totalUnitsValue < 0) {
            alert('A quantidade não pode ser negativa.');
            return;
        }
        if (capacityValue !== undefined && capacityValue < 0) {
            alert('Capacidade inválida.');
            return;
        }
        if (inventoryFor4GuestsValue !== undefined && inventoryFor4GuestsValue < 0) {
            alert('Subinventário de 4 hóspedes inválido.');
            return;
        }
        if (basePriceValue !== undefined && (Number.isNaN(basePriceValue) || basePriceValue < 0)) {
            alert('Preço base inválido.');
            return;
        }

        if (totalUnitsValue === undefined && inventoryFor4GuestsValue === undefined && basePriceValue === undefined && capacityValue === undefined) {
            alert('Preencha pelo menos um campo para atualizar.');
            return;
        }

        try {
            const response = await fetch('/api/admin/rooms', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomTypeId: batchData.roomTypeId,
                    ...(totalUnitsValue !== undefined ? { totalUnits: totalUnitsValue } : {}),
                    ...(inventoryFor4GuestsValue !== undefined ? { inventoryFor4Guests: inventoryFor4GuestsValue } : {}),
                    ...(basePriceValue !== undefined ? { basePrice: basePriceValue } : {}),
                    ...(capacityValue !== undefined ? { capacity: capacityValue } : {})
                })
            });

            if (!response.ok) throw new Error('Erro ao atualizar quartos em lote');

            await fetchRooms();
            setBatchModalOpen(false);
            setBatchData({
                roomTypeId: 'all',
                totalUnits: '',
                inventoryFor4Guests: '',
                basePrice: '',
                capacity: ''
            });
            alert('Quartos atualizados com sucesso!');
        } catch (error) {
            alert('Erro ao atualizar quartos em lote');
            console.error(error);
        }
    };

    const handleCreateRoom = async () => {
        if (!creatingRoom.name.trim() || !creatingRoom.description.trim()) {
            alert('Nome e descrição são obrigatórios.');
            return;
        }
        if (creatingRoom.capacity <= 0) {
            alert('Capacidade inválida.');
            return;
        }
        if (creatingRoom.totalUnits < 0) {
            alert('Unidades inválidas.');
            return;
        }
        if (creatingRoom.inventoryFor4Guests < 0 || creatingRoom.inventoryFor4Guests > creatingRoom.totalUnits) {
            alert('O subinventário para 4 hóspedes deve ficar entre 0 e o total de unidades.');
            return;
        }
        if (Number.isNaN(creatingRoom.basePrice) || creatingRoom.basePrice < 0) {
            alert('Preço base inválido.');
            return;
        }

        const photos = creatingRoom.photosText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean);

        try {
            const response = await fetch('/api/admin/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: creatingRoom.name,
                    description: creatingRoom.description,
                    capacity: creatingRoom.capacity,
                    totalUnits: creatingRoom.totalUnits,
                    inventoryFor4Guests: creatingRoom.inventoryFor4Guests,
                    basePrice: creatingRoom.basePrice,
                    amenities: creatingRoom.amenities,
                    photos,
                }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                const msg =
                    data && typeof data === 'object' && typeof (data as any).error === 'string'
                        ? (data as any).error
                        : 'Erro ao criar quarto';
                throw new Error(msg);
            }

            await fetchRooms();
            setCreateModalOpen(false);
            alert('Quarto criado com sucesso!');
        } catch (error) {
            console.error(error);
            alert(error instanceof Error ? error.message : 'Erro ao criar quarto');
        }
    };

    if (loading) {
        return (
            <div className={styles.loading}>Carregando...</div>
        );
    }

    return (
        <>
            <div className={styles.pageHeader}>
                <h2>Gerenciar Quartos ({rooms.length})</h2>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                        onClick={() => setCreateModalOpen(true)}
                        className={styles.batchButton}
                    >
                        ➕ Adicionar Quarto
                    </button>
                    <button
                        onClick={() => setBatchModalOpen(true)}
                        className={styles.batchButton}
                    >
                        📦 Edição em Lote
                    </button>
                </div>
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
                                    <span className={styles.specLabel}>Até 4 hóspedes:</span>
                                    <span className={styles.specValue}>{room.inventoryFor4Guests} unid.</span>
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
                                <label>Unidades para 4 hóspedes:</label>
                                <input
                                    type="number"
                                    min="0"
                                    max={editingRoom.totalUnits}
                                    value={editingRoom.inventoryFor4Guests}
                                    onChange={(e) => setEditingRoom({
                                        ...editingRoom,
                                        inventoryFor4Guests: parseInt(e.target.value) || 0
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
            {createModalOpen && (
                <div className={styles.modal}>
                    <div className={styles.modalContent}>
                        <h2>Novo Quarto</h2>

                        <div className={styles.formField}>
                            <label>Nome:</label>
                            <input
                                type="text"
                                value={creatingRoom.name}
                                onChange={(e) => setCreatingRoom({ ...creatingRoom, name: e.target.value })}
                            />
                        </div>

                        <div className={styles.formField}>
                            <label>Descrição:</label>
                            <textarea
                                value={creatingRoom.description}
                                onChange={(e) => setCreatingRoom({ ...creatingRoom, description: e.target.value })}
                                rows={3}
                            />
                        </div>

                        <div className={styles.formRow}>
                            <div className={styles.formField}>
                                <label>Capacidade:</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={creatingRoom.capacity}
                                    onChange={(e) =>
                                        setCreatingRoom({
                                            ...creatingRoom,
                                            capacity: parseInt(e.target.value) || 1,
                                        })
                                    }
                                />
                            </div>

                            <div className={styles.formField}>
                                <label>Unidades:</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={creatingRoom.totalUnits}
                                    onChange={(e) =>
                                        setCreatingRoom({
                                            ...creatingRoom,
                                            totalUnits: parseInt(e.target.value) || 0,
                                        })
                                    }
                                />
                            </div>

                            <div className={styles.formField}>
                                <label>Unidades para 4 hóspedes:</label>
                                <input
                                    type="number"
                                    min="0"
                                    max={creatingRoom.totalUnits}
                                    value={creatingRoom.inventoryFor4Guests}
                                    onChange={(e) =>
                                        setCreatingRoom({
                                            ...creatingRoom,
                                            inventoryFor4Guests: parseInt(e.target.value) || 0,
                                        })
                                    }
                                />
                            </div>

                            <div className={styles.formField}>
                                <label>Preço (R$):</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={creatingRoom.basePrice}
                                    onChange={(e) =>
                                        setCreatingRoom({
                                            ...creatingRoom,
                                            basePrice: Number(e.target.value) || 0,
                                        })
                                    }
                                />
                            </div>
                        </div>

                        <div className={styles.formField}>
                            <label>Comodidades:</label>
                            <textarea
                                value={creatingRoom.amenities}
                                onChange={(e) => setCreatingRoom({ ...creatingRoom, amenities: e.target.value })}
                                rows={2}
                            />
                        </div>

                        <div className={styles.formField}>
                            <label>Fotos (1 URL por linha):</label>
                            <textarea
                                value={creatingRoom.photosText}
                                onChange={(e) => setCreatingRoom({ ...creatingRoom, photosText: e.target.value })}
                                rows={3}
                            />
                        </div>

                        <div className={styles.modalActions}>
                            <button onClick={() => setCreateModalOpen(false)} className={styles.cancelButton}>
                                Cancelar
                            </button>
                            <button onClick={handleCreateRoom} className={styles.saveButton}>
                                Criar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {batchModalOpen && (
                <div className={styles.modal}>
                    <div className={styles.modalContent}>
                        <h2>Edição em Lote</h2>
                        <p className={styles.modalDescription}>
                            Atualize a quantidade de unidades disponíveis para múltiplos quartos de uma vez.
                        </p>

                        <div className={styles.formField}>
                            <label>Tipo de Quarto:</label>
                            <select
                                value={batchData.roomTypeId}
                                onChange={(e) => setBatchData({
                                    ...batchData,
                                    roomTypeId: e.target.value
                                })}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    borderRadius: '6px',
                                    border: '1px solid #ddd',
                                    fontSize: '1rem'
                                }}
                            >
                                <option value="all">Todos os Quartos</option>
                                {rooms.map(room => (
                                    <option key={room.id} value={room.id}>
                                        {room.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.formField}>
                            <label>Nova Quantidade Disponível (Total Units):</label>
                            <input
                                type="number"
                                min="0"
                                value={batchData.totalUnits}
                                onChange={(e) => setBatchData({
                                    ...batchData,
                                    totalUnits: e.target.value
                                })}
                            />
                        </div>

                        <div className={styles.formField}>
                            <label>Nova Capacidade:</label>
                            <input
                                type="number"
                                min="0"
                                value={batchData.capacity}
                                onChange={(e) => setBatchData({
                                    ...batchData,
                                    capacity: e.target.value
                                })}
                                />
                        </div>

                        <div className={styles.formField}>
                            <label>Novo Subinventário para 4 hóspedes:</label>
                            <input
                                type="number"
                                min="0"
                                value={batchData.inventoryFor4Guests}
                                onChange={(e) => setBatchData({
                                    ...batchData,
                                    inventoryFor4Guests: e.target.value
                                })}
                            />
                        </div>

                        <div className={styles.formField}>
                            <label>Novo Preço Base (R$):</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={batchData.basePrice}
                                onChange={(e) => setBatchData({
                                    ...batchData,
                                    basePrice: e.target.value
                                })}
                            />
                        </div>

                        <div className={styles.modalActions}>
                            <button
                                onClick={() => setBatchModalOpen(false)}
                                className={styles.cancelButton}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleBatchSave}
                                className={styles.saveButton}
                            >
                                Salvar Alterações
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
