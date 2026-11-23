import { getLocalRoomPhotos } from '@/lib/room-photos';

const PLACEHOLDER_DOMAINS = [
    'picsum.photos',
    'unsplash.com',
    'images.unsplash.com',
    'source.unsplash.com',
    'via.placeholder.com',
    'placeholder.com',
    'placehold.co',
];

/** Fotos do quarto: as cadastradas (sem imagem de exemplo); se não houver, as locais do tipo de quarto. */
export function getDisplayPhotoUrls(room: { name: string; photos?: Array<{ url?: string | null }> | null }): string[] {
    const backend = (room.photos ?? [])
        .map((photo) => String(photo?.url || '').trim())
        .filter((url) => url && !PLACEHOLDER_DOMAINS.some((domain) => url.toLowerCase().includes(domain)));
    return backend.length > 0 ? backend : (getLocalRoomPhotos(room.name) ?? []);
}

export function formatBrl(value: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
