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
    console.log(`[getLocalRoomPhotos] Buscando fotos para: ${roomName}`);

    const basePath = ROOM_PHOTO_MAPPING[roomName];
    if (!basePath) {
        console.log(`[getLocalRoomPhotos] Nenhum mapeamento encontrado para: ${roomName}`);
        return null;
    }

    console.log(`[getLocalRoomPhotos] Mapeamento encontrado: ${basePath}`);

    // Mapeamento específico de fotos para cada tipo de quarto
    const roomPhotoMap: Record<string, string[]> = {
        'Apartamento Anexo': [
            `${basePath}/IMG_0029-1200.webp`,
            `${basePath}/IMG_0030-1200.webp`,
            `${basePath}/IMG_0031-1200.webp`,
            `${basePath}/IMG_0033-1200.webp`,
            `${basePath}/IMG_0034-1200.webp`,
            `${basePath}/IMG_0037-1200.webp`,
            `${basePath}/IMG_0038-1200.webp`,
            `${basePath}/IMG_0040-1200.webp`,
            `${basePath}/IMG_0042-1200.webp`,
            `${basePath}/IMG_0044-1200.webp`,
            `${basePath}/IMG_0046-1200.webp`,
            `${basePath}/IMG_0048-1200.webp`,
            `${basePath}/IMG_0050-1200.webp`,
            `${basePath}/IMG_0051-1200.webp`,
            `${basePath}/IMG_0054-1200.webp`,
            `${basePath}/IMG_0055-1200.webp`,
            `${basePath}/IMG_0056-1200.webp`,
            `${basePath}/IMG_0058-1200.webp`,
            `${basePath}/IMG_0059-1200.webp`,
            `${basePath}/IMG_0069-1200.webp`,
            `${basePath}/IMG_0070-1200.webp`,
            `${basePath}/IMG_0072-1200.webp`,
            `${basePath}/IMG_0073-1200.webp`,
            `${basePath}/IMG_0074-1200.webp`,
            `${basePath}/IMG_0075-1200.webp`,
            `${basePath}/IMG_0077-1200.webp`,
            `${basePath}/IMG_0078-1200.webp`,
            `${basePath}/IMG_0080-1200.webp`,
            `${basePath}/IMG_0081-1200.webp`,
            `${basePath}/IMG_0085-1200.webp`,
            `${basePath}/IMG_0087-1200.webp`,
            `${basePath}/IMG_0088-1200.webp`,
            `${basePath}/IMG_0089-1200.webp`,
            `${basePath}/IMG_0094-1200.webp`,
            `${basePath}/IMG_0096-1200.webp`,
            `${basePath}/IMG_0097-1200.webp`,
            `${basePath}/IMG_0100-1200.webp`,
            `${basePath}/IMG_0101-1200.webp`,
            `${basePath}/IMG_0103-1200.webp`,
            `${basePath}/IMG_0104-1200.webp`,
            `${basePath}/IMG_0106-1200.webp`,
            `${basePath}/IMG_0107-1200.webp`,
        ],
        'Chalé': [
            `${basePath}/IMG_0109-1200.webp`,
            `${basePath}/IMG_0110-1200.webp`,
            `${basePath}/IMG_0111-1200.webp`,
            `${basePath}/IMG_0112-1200.webp`,
            `${basePath}/IMG_0114-1200.webp`,
            `${basePath}/IMG_0115-1200.webp`,
            `${basePath}/IMG_0117-1200.webp`,
            `${basePath}/IMG_0118-1200.webp`,
            `${basePath}/IMG_0120-1200.webp`,
            `${basePath}/IMG_0121-1200.webp`,
            `${basePath}/IMG_0122-1200.webp`,
            `${basePath}/IMG_0125-1200.webp`,
        ],
        'Apartamento Superior': [
            `${basePath}/DSC_0039-1200.webp`,
            `${basePath}/DSC_0041-1200.webp`,
            `${basePath}/DSC_0043-1200.webp`,
            `${basePath}/DSC_0045-1200.webp`,
            `${basePath}/DSC_0046-1200.webp`,
            `${basePath}/DSC_0047-1200.webp`,
            `${basePath}/DSC_0050-1200.webp`,
            `${basePath}/DSC_0051-1200.webp`,
            `${basePath}/DSC_0058-1200.webp`,
        ],
        'Apartamento Térreo': [
            `${basePath}/com-janela/DSC_0001-1200.webp`,
            `${basePath}/com-janela/DSC_0003-1200.webp`,
            `${basePath}/com-janela/DSC_0005-1200.webp`,
            `${basePath}/com-janela/DSC_0006-1200.webp`,
            `${basePath}/com-janela/DSC_0009-1200.webp`,
            `${basePath}/com-janela/DSC_0010-1200.webp`,
            `${basePath}/com-janela/DSC_0015-1200.webp`,
            `${basePath}/com-janela/DSC_0017-1200.webp`,
            `${basePath}/com-janela/DSC_0018-1200.webp`,
            `${basePath}/com-janela/DSC_0022-1200.webp`,
            `${basePath}/com-janela/DSC_0024-1200.webp`,
            `${basePath}/com-janela/DSC_0027-1200.webp`,
        ],
    };

    const photos = roomPhotoMap[roomName] || [`${basePath}/DSC_0001-1200.webp`]; // Fallback para primeira foto
    console.log(`[getLocalRoomPhotos] Retornando ${photos.length} fotos para ${roomName}`);
    return photos;
}