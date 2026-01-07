## Estrutura de Pastas
- Criar base para assets estáticos:
  - `web/public/fotos/ala-principal/apartamentos/terreo/`
  - `web/public/fotos/ala-principal/apartamentos/superior/`
  - `web/public/fotos/ala-chales/chales/`
  - `web/public/fotos/ala-chales/apartamentos-anexo/`

## Convenção de Nomes
- Nomear arquivos por ambiente e cômodo, com sufixo de tamanho:
  - `quarto-1-480.webp`, `quarto-1-768.webp`, `quarto-1-1200.webp`, `quarto-1-1920.webp`
  - `banheiro-1-1200.webp`, `sala-1-1200.webp`
- Usar apenas letras minúsculas, hífen, sem espaços; manter número incremental por cômodo.

## Movimentação e Renomeação
- Detectar pasta atual de fotos (onde você colou) e mover para os diretórios acima.
- Renomear automaticamente conforme convenção (baseado no nome original e pasta destino).
- Evitar sobrescritas; gerar relatório do mapeamento antigo → novo caminho.

## Otimização de Imagens
- Adicionar script `scripts/optimize-images.mjs` usando `sharp` para:
  - Converter para WebP
  - Gerar tamanhos: 480, 768, 1200, 1920
  - Manter metadados básicos (orientação), remover EXIF sensível
- Comandos:
  - `cd web`
  - `npm i sharp -D`
  - `node scripts/optimize-images.mjs`

## Integração no Código
- Usar `next/image` para todas imagens de acomodações (App Router):
  - `web/src/app/acomodacoes/[id]/page.tsx`: trocar `<img>` por `<Image>` com `sizes`, `width`/`height` apropriados.
- `web/next.config.ts`: garantir que imagens estáticas de `public` são suportadas (não requer remotePatterns); manter domínios remotos apenas se houver URLs externas restantes.

## Atualização dos Dados
- `web/prisma/seed.js`: substituir URLs `picsum.photos` pelas novas URLs locais (`/fotos/...`).
- Para base existente, criar `scripts/update-photo-urls.ts` que atualiza `Photo.url` para os novos caminhos por tipo de acomodação, sem alterar `roomTypeId`.

## Verificação
- `npm run build` para validar.
- Acessar `/acomodacoes` e páginas de detalhes para verificar galeria e performance (lazy, responsivo).

## Deploy
- Commit/PR com mudanças.
- Na Vercel: limpar cache de build, confirmar `Root Directory: web`, redeploy.

## Entregáveis
1. Estrutura `public/fotos` criada e fotos movidas/renomeadas.
2. Script de otimização pronto e executado, arquivos WebP responsivos gerados.
3. Código atualizado para `next/image` (acomodacoes) e config ajustada.
4. Seed atualizado e (opcional) script de migração de URLs para produção.
5. Build validado e instruções de deploy.

Aprovar para eu executar: mover e renomear as fotos, otimizar, atualizar o código e dados, validar build e preparar o deploy.