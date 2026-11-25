/**
 * Mapeamento de tipos de quartos para suas respectivas pastas de fotos locais
 */

export const ROOM_PHOTO_MAPPING: Record<string, string> = {
    'Apartamento Anexo': '/fotos/ala-chales/apartamentos-anexo',
    'Chalé': '/fotos/ala-chales/chales',
    'Apartamento Superior': '/fotos/ala-principal/apartamentos/superior',
    'Apartamento Térreo': '/fotos/ala-principal/apartamentos/terreo',
};

/**
 * Função para obter fotos locais de um quarto baseado no seu tipo
 * @param roomName - Nome do tipo de quarto
 * @returns Array de URLs de fotos locais ou null se não houver mapeamento
 */
export function getLocalRoomPhotos(roomName: string): string[] | null {
    const basePath = ROOM_PHOTO_MAPPING[roomName];
    if (!basePath) {
        return null;
    }

    // Até 8 fotos por tipo de quarto (menos é mais). As fotos com decoração romântica ficam na seção própria (constants/romanticDecor.ts).
    const roomPhotoMap: Record<string, string[]> = {
        'Apartamento Anexo': [
            `${basePath}/IMG_0050-1200.webp`,
            `${basePath}/IMG_0087-1200.webp`,
            `${basePath}/IMG_0080-1200.webp`,
            `${basePath}/IMG_0031-1200.webp`,
            `${basePath}/IMG_0085-1200.webp`,
            `${basePath}/IMG_0046-1200.webp`,
            `${basePath}/IMG_0069-1200.webp`,
            `${basePath}/IMG_0096-1200.webp`,
        ],
        'Chalé': [
            `${basePath}/IMG_0109-1200.webp`,
            `${basePath}/IMG_0110-1200.webp`,
            `${basePath}/IMG_0111-1200.webp`,
            `${basePath}/IMG_0114-1200.webp`,
            `${basePath}/IMG_0118-1200.webp`,
            `${basePath}/IMG_0115-1200.webp`,
            `${basePath}/IMG_0120-1200.webp`,
            `${basePath}/IMG_0122-1200.webp`,
        ],
        'Apartamento Superior': [
            `${basePath}/DSC_0039-1200.webp`,
            `${basePath}/DSC_0046-1200.webp`,
            `${basePath}/DSC_0045-1200.webp`,
            `${basePath}/DSC_0050-1200.webp`,
            `${basePath}/DSC_0072-1200.webp`,
            `${basePath}/DSC_0041-1200.webp`,
            `${basePath}/DSC_0076-1200.webp`,
        ],
        'Apartamento Térreo': [
            `${basePath}/com-janela/DSC_0001-1200.webp`,
            `${basePath}/com-janela/DSC_0003-1200.webp`,
            `${basePath}/com-janela/DSC_0005-1200.webp`,
            `${basePath}/com-janela/DSC_0010-1200.webp`,
            `${basePath}/com-janela/DSC_0006-1200.webp`,
            `${basePath}/com-janela/DSC_0024-1200.webp`,
            `${basePath}/com-janela/DSC_0017-1200.webp`,
            `${basePath}/com-janela/DSC_0027-1200.webp`,
        ],
    };

    return roomPhotoMap[roomName] || [`${basePath}/DSC_0001-1200.webp`];
}
