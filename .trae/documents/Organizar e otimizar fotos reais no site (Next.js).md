## Objetivo
- Mover a pasta "fotos" para o local correto no projeto, organizar por alas e tipos de acomodações, otimizar as imagens e atualizar o site para usar essas fotos reais.

## Estrutura de Arquivos Destino
- Colocar as imagens estáticas dentro de `web/public/fotos` para servir via Next.js sem código adicional.
- Estrutura proposta:
  - `web/public/fotos/ala-principal/apartamentos/terreo/`
  - `web/public/fotos/ala-principal/apartamentos/superior/`
  - `web/public/fotos/ala-chales/chales/`
  - `web/public/fotos/ala-chales/apartamentos-anexo/`

## Otimização das Fotos
- Converter e reduzir arquivos para WebP e tamanhos responsivos (480, 768, 1200, 1920).
- Ferramenta: `sharp` ou `squoosh-cli` (ambas funcionam)
- Comandos (após aprovação, eu adiciono script):
  1. `npm i sharp -D`
  2. Criar script `scripts/optimize-images.mjs` que percorre `web/public/fotos/**` e gera versões WebP otimizadas por tamanho.
  3. Executar: `node scripts/optimize-images.mjs`

## Atualização do Código (exibição)
- Substituir `<img>` por `next/image` em `web/src/app/acomodacoes/[id]/page.tsx` para melhor performance e lazy-loading.
- Manter fonte das fotos pelo banco (tabela `Photo`), mas apontar `photo.url` para os assets estáticos em `public` via URLs relativas.
  - Exemplo de URL: `/fotos/ala-principal/apartamentos/superior/sala-1-1200.webp`

## Atualização dos Dados (Photo URLs)
- Atualizar `prisma/seed.js` para usar as novas URLs locais ao invés de `picsum.photos`:
  - Apartamento Superior → `/fotos/ala-principal/apartamentos/superior/...`
  - Apartamento Térreo → `/fotos/ala-principal/apartamentos/terreo/...`
  - Chalés → `/fotos/ala-chales/chales/...`
- Para base existente em produção, criar script utilitário opcional `scripts/update-photo-urls.ts` que atualiza os registros da tabela `Photo` com os novos caminhos, preservando os `roomTypeId`.

## Patches Planejados
1. `web/src/app/acomodacoes/[id]/page.tsx`
   - Trocar `<img src={photo.url} ...>` por `<Image src={photo.url} ... fill/width/height sizes />` (import `next/image`).
2. `web/prisma/seed.js`
   - Substituir URLs de `picsum.photos` pelas novas rotas em `public/fotos/...` e adicionar mais fotos conforme pasta.
3. (Opcional) `scripts/optimize-images.mjs`
   - Script para gerar WebP responsivo com `sharp`.
4. (Opcional) `scripts/update-photo-urls.ts`
   - Script que atualiza `Photo.url` no banco para apontar para `public/fotos/...` por tipo de acomodação.

## Passos de Execução
1. Mover/organizar a pasta "fotos" para `web/public/fotos` com a estrutura acima.
2. Rodar a otimização das imagens e gerar versões WebP responsivas.
3. Aplicar patches no código (Image component e seed).
4. Atualizar dados: rodar seed localmente (ambiente de dev) e/ou executar script de atualização para produção.
5. Validar: `npm run build` e abrir páginas de acomodações para verificar carregamento e performance.
6. Deploy na Vercel: commit/PR, limpar cache de build e redeploy.

## Observações Técnicas
- Assets em `public` são servidos diretamente: `/fotos/...` sem configuração adicional.
- `next/image` exige domínio/paths locais; como os assets ficam em `public`, não é necessário configurar `images.remotePatterns`.
- Mantemos a compatibilidade com o App Router; nenhuma mudança de rota necessária.

Confirme para eu executar: mover/organizar as imagens, otimizar, aplicar os patches e atualizar os dados, validando tudo com build e preview.