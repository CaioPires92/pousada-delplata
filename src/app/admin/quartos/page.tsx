'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
    Plus, 
    Pencil, 
    Users, 
    Home, 
    Banknote, 
    Box, 
    Layers, 
    Info, 
    Image as ImageIcon,
    X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
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
        name: '',
        description: '',
        capacity: 2,
        totalUnits: 1,
        inventoryFor4Guests: 0,
        basePrice: 0,
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
        } catch (error) {
            console.error(error);
            alert(error instanceof Error ? error.message : 'Erro ao criar quarto');
        }
    };

    if (loading) {
        return (
            <div className={styles.loading}>
                <div className={styles.loadingSpinner}></div>
                <p>Carregando acomodações...</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.main}>
                <div className={styles.pageHeader}>
                    <div>
                        <h2>Gerenciar Quartos</h2>
                        <p className="text-slate-500 mt-2 font-medium">Configure as categorias, capacidades e preços base.</p>
                    </div>
                    <div className={styles.headerActions}>
                        <Button 
                            onClick={() => setBatchModalOpen(true)}
                            variant="outline"
                            className="h-11 px-6 border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold gap-2"
                        >
                            <Box className="w-4 h-4" />
                            Edição em Lote
                        </Button>
                        <Button 
                            onClick={() => setCreateModalOpen(true)}
                            className="h-11 px-6 bg-slate-900 hover:bg-slate-800 text-white font-semibold gap-2 shadow-lg shadow-slate-200"
                        >
                            <Plus className="w-4 h-4" />
                            Adicionar Quarto
                        </Button>
                    </div>
                </div>

                <div className={styles.roomsGrid}>
                    {rooms.map((room) => (
                        <Card key={room.id} className={styles.roomCard}>
                            <CardHeader className={styles.roomHeader}>
                                <div className="flex flex-col gap-1">
                                    <CardTitle className={styles.roomHeaderH3}>{room.name}</CardTitle>
                                    <Badge variant="secondary" className="w-fit bg-slate-100 text-slate-700 hover:bg-slate-100 border-none px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold">
                                        ID: {room.id.substring(0, 8)}
                                    </Badge>
                                </div>
                                <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    onClick={() => handleEdit(room)}
                                    className="h-9 w-9 rounded-full hover:bg-slate-100 transition-colors"
                                >
                                    <Pencil className="w-4 h-4 text-slate-600" />
                                </Button>
                            </CardHeader>
                            <CardContent className={styles.roomDetails}>
                                <p className={styles.description}>{room.description}</p>

                                <div className={styles.specs}>
                                    <div className={styles.spec}>
                                        <span className={styles.specLabel}>Capacidade</span>
                                        <div className="flex items-center gap-2">
                                            <Users className="w-3.5 h-3.5 text-slate-400" />
                                            <span className={styles.specValue}>{room.capacity} pessoas</span>
                                        </div>
                                    </div>
                                    <div className={styles.spec}>
                                        <span className={styles.specLabel}>Unidades</span>
                                        <div className="flex items-center gap-2">
                                            <Home className="w-3.5 h-3.5 text-slate-400" />
                                            <span className={styles.specValue}>{room.totalUnits} unid.</span>
                                        </div>
                                    </div>
                                    <div className={styles.spec}>
                                        <span className={styles.specLabel}>Subinventário (4p)</span>
                                        <div className="flex items-center gap-2">
                                            <Layers className="w-3.5 h-3.5 text-slate-400" />
                                            <span className={styles.specValue}>{room.inventoryFor4Guests} unid.</span>
                                        </div>
                                    </div>
                                    <div className={styles.spec}>
                                        <span className={styles.specLabel}>Preço Base</span>
                                        <div className="flex items-center gap-2">
                                            <Banknote className="w-3.5 h-3.5 text-emerald-500" />
                                            <span className={styles.specValue}>R$ {Number(room.basePrice).toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.amenities}>
                                    <strong>Comodidades</strong>
                                    <p>{room.amenities || 'Nenhuma comodidade informada.'}</p>
                                </div>

                                <div className={styles.photos}>
                                    <ImageIcon className="w-4 h-4" />
                                    <span>{room.photos.length} fotos cadastradas</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Modal de Edição */}
            {editingRoom && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h2>Editar Acomodação</h2>
                            <p className={styles.modalDescription}>Atualize os detalhes de {editingRoom.name}.</p>
                        </div>

                        <div className={styles.formGrid}>
                            <div className={cn(styles.formField, styles.formFieldFull)}>
                                <Label>Nome da Acomodação</Label>
                                <Input
                                    value={editingRoom.name}
                                    onChange={(e) => setEditingRoom({...editingRoom, name: e.target.value})}
                                    className={styles.input}
                                />
                            </div>

                            <div className={cn(styles.formField, styles.formFieldFull)}>
                                <Label>Descrição</Label>
                                <Textarea
                                    value={editingRoom.description}
                                    onChange={(e) => setEditingRoom({...editingRoom, description: e.target.value})}
                                    rows={3}
                                    className={styles.textarea}
                                />
                            </div>

                            <div className={styles.formField}>
                                <Label>Capacidade (Hóspedes)</Label>
                                <Input
                                    type="number"
                                    value={editingRoom.capacity}
                                    onChange={(e) => setEditingRoom({...editingRoom, capacity: parseInt(e.target.value) || 0})}
                                    className={styles.input}
                                />
                            </div>

                            <div className={styles.formField}>
                                <Label>Total de Unidades</Label>
                                <Input
                                    type="number"
                                    value={editingRoom.totalUnits}
                                    onChange={(e) => setEditingRoom({...editingRoom, totalUnits: parseInt(e.target.value) || 0})}
                                    className={styles.input}
                                />
                            </div>

                            <div className={styles.formField}>
                                <Label>Subinventário (4 pessoas)</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    max={editingRoom.totalUnits}
                                    value={editingRoom.inventoryFor4Guests}
                                    onChange={(e) => setEditingRoom({...editingRoom, inventoryFor4Guests: parseInt(e.target.value) || 0})}
                                    className={styles.input}
                                />
                            </div>

                            <div className={styles.formField}>
                                <Label>Preço Base (R$)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={editingRoom.basePrice}
                                    onChange={(e) => setEditingRoom({...editingRoom, basePrice: parseFloat(e.target.value) || 0})}
                                    className={styles.input}
                                />
                            </div>

                            <div className={cn(styles.formField, styles.formFieldFull)}>
                                <Label>Comodidades</Label>
                                <Textarea
                                    value={editingRoom.amenities}
                                    onChange={(e) => setEditingRoom({...editingRoom, amenities: e.target.value})}
                                    rows={2}
                                    className={styles.textarea}
                                />
                            </div>
                        </div>

                        <div className={styles.modalActions}>
                            <Button variant="ghost" onClick={() => setEditingRoom(null)} className="h-11 px-6 text-slate-600 font-semibold">
                                Cancelar
                            </Button>
                            <Button onClick={handleSave} className="h-11 px-10 bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-lg shadow-slate-200">
                                Salvar Alterações
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Criação */}
            {createModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h2>Nova Acomodação</h2>
                            <p className={styles.modalDescription}>Cadastre uma nova categoria de quarto.</p>
                        </div>

                        <div className={styles.formGrid}>
                            <div className={cn(styles.formField, styles.formFieldFull)}>
                                <Label>Nome</Label>
                                <Input
                                    placeholder="Ex: Suíte Master"
                                    value={creatingRoom.name}
                                    onChange={(e) => setCreatingRoom({...creatingRoom, name: e.target.value})}
                                    className={styles.input}
                                />
                            </div>

                            <div className={cn(styles.formField, styles.formFieldFull)}>
                                <Label>Descrição</Label>
                                <Textarea
                                    placeholder="Descreva o quarto..."
                                    value={creatingRoom.description}
                                    onChange={(e) => setCreatingRoom({...creatingRoom, description: e.target.value})}
                                    rows={3}
                                    className={styles.textarea}
                                />
                            </div>

                            <div className={styles.formField}>
                                <Label>Capacidade</Label>
                                <Input
                                    type="number"
                                    value={creatingRoom.capacity}
                                    onChange={(e) => setCreatingRoom({...creatingRoom, capacity: parseInt(e.target.value) || 1})}
                                    className={styles.input}
                                />
                            </div>

                            <div className={styles.formField}>
                                <Label>Total de Unidades</Label>
                                <Input
                                    type="number"
                                    value={creatingRoom.totalUnits}
                                    onChange={(e) => setCreatingRoom({...creatingRoom, totalUnits: parseInt(e.target.value) || 0})}
                                    className={styles.input}
                                />
                            </div>

                            <div className={styles.formField}>
                                <Label>Preço Base (R$)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={creatingRoom.basePrice}
                                    onChange={(e) => setCreatingRoom({...creatingRoom, basePrice: parseFloat(e.target.value) || 0})}
                                    className={styles.input}
                                />
                            </div>

                            <div className={styles.formField}>
                                <Label>Subinventário (4p)</Label>
                                <Input
                                    type="number"
                                    value={creatingRoom.inventoryFor4Guests}
                                    onChange={(e) => setCreatingRoom({...creatingRoom, inventoryFor4Guests: parseInt(e.target.value) || 0})}
                                    className={styles.input}
                                />
                            </div>

                            <div className={cn(styles.formField, styles.formFieldFull)}>
                                <Label>Comodidades</Label>
                                <Textarea
                                    placeholder="TV, Ar Condicionado, Wi-Fi..."
                                    value={creatingRoom.amenities}
                                    onChange={(e) => setCreatingRoom({...creatingRoom, amenities: e.target.value})}
                                    rows={2}
                                    className={styles.textarea}
                                />
                            </div>

                            <div className={cn(styles.formField, styles.formFieldFull)}>
                                <Label>Fotos (1 URL por linha)</Label>
                                <Textarea
                                    placeholder="https://imagem.jpg"
                                    value={creatingRoom.photosText}
                                    onChange={(e) => setCreatingRoom({...creatingRoom, photosText: e.target.value})}
                                    rows={3}
                                    className={styles.textarea}
                                />
                            </div>
                        </div>

                        <div className={styles.modalActions}>
                            <Button variant="ghost" onClick={() => setCreateModalOpen(false)} className="h-11 px-6 text-slate-600 font-semibold">
                                Cancelar
                            </Button>
                            <Button onClick={handleCreateRoom} className="h-11 px-10 bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-lg shadow-slate-200">
                                Criar Quarto
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Lote */}
            {batchModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h2>Edição em Lote</h2>
                            <p className={styles.modalDescription}>Atualize múltiplos quartos de uma só vez.</p>
                        </div>

                        <div className="space-y-6">
                            <div className={styles.formField}>
                                <Label>Tipo de Quarto</Label>
                                <select
                                    value={batchData.roomTypeId}
                                    onChange={(e) => setBatchData({...batchData, roomTypeId: e.target.value})}
                                    className={styles.select}
                                >
                                    <option value="all">Todos os Quartos</option>
                                    {rooms.map(room => (
                                        <option key={room.id} value={room.id}>{room.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className={styles.formField}>
                                    <Label>Total de Unidades</Label>
                                    <Input
                                        placeholder="Manter atual"
                                        type="number"
                                        value={batchData.totalUnits}
                                        onChange={(e) => setBatchData({...batchData, totalUnits: e.target.value})}
                                        className={styles.input}
                                    />
                                </div>
                                <div className={styles.formField}>
                                    <Label>Capacidade</Label>
                                    <Input
                                        placeholder="Manter atual"
                                        type="number"
                                        value={batchData.capacity}
                                        onChange={(e) => setBatchData({...batchData, capacity: e.target.value})}
                                        className={styles.input}
                                    />
                                </div>
                                <div className={styles.formField}>
                                    <Label>Subinventário (4p)</Label>
                                    <Input
                                        placeholder="Manter atual"
                                        type="number"
                                        value={batchData.inventoryFor4Guests}
                                        onChange={(e) => setBatchData({...batchData, inventoryFor4Guests: e.target.value})}
                                        className={styles.input}
                                    />
                                </div>
                                <div className={styles.formField}>
                                    <Label>Preço Base (R$)</Label>
                                    <Input
                                        placeholder="Manter atual"
                                        type="number"
                                        step="0.01"
                                        value={batchData.basePrice}
                                        onChange={(e) => setBatchData({...batchData, basePrice: e.target.value})}
                                        className={styles.input}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className={styles.modalActions}>
                            <Button variant="ghost" onClick={() => setBatchModalOpen(false)} className="h-11 px-6 text-slate-600 font-semibold">
                                Cancelar
                            </Button>
                            <Button onClick={handleBatchSave} className="h-11 px-10 bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-lg shadow-slate-200">
                                Aplicar Alterações
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

