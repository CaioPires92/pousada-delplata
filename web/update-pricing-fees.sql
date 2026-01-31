-- Script para atualizar taxas de preços dos quartos
-- extraAdultFee: R$ 100 por adulto extra (incluindo crianças >= 12 anos)
-- child6To11Fee: R$ 80 por criança de 6 a 11 anos

UPDATE RoomType
SET 
    extraAdultFee = 100.00,
    child6To11Fee = 80.00
WHERE id IS NOT NULL;

-- Verificar as mudanças
SELECT 
    id,
    name,
    basePrice,
    extraAdultFee,
    child6To11Fee,
    includedAdults,
    maxGuests
FROM RoomType;
