## Causa
- Home usa imagens fixas do Unsplash, não suas fotos reais.
- A página de Acomodações usa `room.photos`, mas o script de atualização mapeia pastas com nomes específicos. As fotos de térreos foram colocadas em subpastas `com-janela`/`sem-janelas`, enquanto os `RoomType` são genéricos ("Apartamento Térreo"), causando ausência de atualização.

## Correções Planejadas
1. **Home (src/app/page.tsx):** trocar imagens fixas por fotos reais do `public/fotos`.
2. **Acomodações (src/app/acomodacoes/page.tsx):** manter `room.photos`, mas garantir que as URLs no DB sejam atualizadas.
3. **Script DB (scripts/update-photo-urls.mjs):**
   - Para "Térreo": combinar arquivos de `terreo`, `terreo/com-janela` e `terreo/sem-janelas` (aceitar singular/plural) e usar todos na ordem preferindo `*-1200.webp`.
   - Aceitar variações de nomes de pastas (com/sem `janela/janelas`).
   - Logar claramente o que foi atualizado, incluindo `Photo.id → nova URL`.
4. **Executar otimização e atualização:** rodar `optimize-images` e `update-photo-urls` novamente.
5. **Validar build:** `npm run build` e visualização.

## Patches
- `src/app/page.tsx`: substituir URLs do Unsplash por `/fotos/...` representativas (superior/chalés/terreo).
- `scripts/update-photo-urls.mjs`: implementar agregação de subpastas e logs detalhados.

## Passos de Execução
1. Aplicar patches em `page.tsx` e `update-photo-urls.mjs`.
2. `cd web && node scripts/optimize-images.mjs`.
3. `node scripts/update-photo-urls.mjs`.
4. `npm run build`.
5. Deploy na Vercel (limpar cache). 

Aprovar para eu aplicar as mudanças e atualizar a base com as novas URLs, substituindo as imagens da Home pelas fotos reais.