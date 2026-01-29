// Teste das funções de fotos locais
const { getLocalRoomPhotos, ROOM_PHOTO_MAPPING } = require('./src/lib/room-photos.ts');

console.log('=== TESTE DE FOTOS LOCAIS ===');

// Testar mapeamento
console.log('Mapeamentos disponíveis:', Object.keys(ROOM_PHOTO_MAPPING));

// Testar cada tipo de quarto
const roomTypes = ['Apartamento Anexo', 'Chalé', 'Apartamento Superior', 'Apartamento Térreo'];

roomTypes.forEach(roomName => {
    console.log(`\n--- Testando: ${roomName} ---`);
    const photos = getLocalRoomPhotos(roomName);
    if (photos) {
        console.log(`✅ Encontrou ${photos.length} fotos:`);
        photos.slice(0, 3).forEach((photo, index) => {
            console.log(`  ${index + 1}. ${photo}`);
        });
        if (photos.length > 3) {
            console.log(`  ... e mais ${photos.length - 3} fotos`);
        }
    } else {
        console.log(`❌ Nenhuma foto local encontrada`);
    }
});

// Testar quarto inexistente
console.log(`\n--- Testando: Quarto Inexistente ---`);
const invalidPhotos = getLocalRoomPhotos('Quarto Inexistente');
console.log(`Resultado: ${invalidPhotos ? 'Encontrou fotos' : 'Nenhuma foto (correto)'}`);