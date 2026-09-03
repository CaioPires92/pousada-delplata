# Auditoria de Performance e Acessibilidade

Data: 2026-09-03
Projeto: Pousada Delplata

## Evidências encontradas

- A pasta `public` contém 622 imagens, somando aproximadamente 87,6 MB.
- O favicon configurado apontava para `public/fotos/logo.png`, arquivo de aproximadamente 2,3 MB. O projeto já possui `src/app/favicon.ico`, com aproximadamente 346 KB.
- A galeria da home usava `unoptimized` em todas as imagens, bypassando a otimização automática do Next.js.
- A home carregava os componentes interativos de ofertas e datas especiais no mesmo bundle inicial.
- O cabeçalho carregava o logo com `priority`, enquanto o hero também é um recurso prioritário.
- Google Tag/Analytics e Microsoft Clarity eram iniciados com `afterInteractive` em todas as páginas.
- O link do logo cancelava a navegação do Next.js e forçava `window.location.href`, gerando recarga completa.
- O botão do menu mobile não tinha nome acessível, estado expandido nem relação explícita com o menu.

## Correções aplicadas

- Favicon alterado para `/favicon.ico`.
- Clarity e Google Tag alterados para `lazyOnload`.
- Imagens da galeria voltaram a usar o otimizador do Next.js.
- Qualidade do hero reduzida de 88 para 75, mantendo `priority` apenas no recurso visual principal.
- Ofertas e datas especiais da home passaram a ser carregadas em chunks separados.
- `framer-motion` removido do Footer, que não precisava de animação para funcionar.
- Navegação do logo voltou a usar navegação normal do Next.js.
- Menu mobile recebeu `aria-label`, `aria-expanded`, `aria-controls` e `type="button"`.
- Navegações desktop e mobile receberam rótulos semânticos.

## Próxima medição

Executar uma nova análise no PageSpeed após o deploy. A pontuação publicada não foi reproduzida localmente porque a URL do relatório é dinâmica e o build local depende de `/bin/bash`, que não existe nesta instalação Windows.

Prioridades restantes: gerar versões WebP/AVIF menores para as imagens mais acessadas, revisar o peso do logo usado no rodapé e medir LCP, INP, CLS e Total Blocking Time em uma nova execução mobile e desktop.
