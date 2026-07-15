# Conversão e reservas diretas — status de implementação

Atualizado em 15/07/2026 na branch `feat/conversao-reservas-diretas`.

## Entregue nesta branch

- Funil de analytics: busca, visualização, seleção, início do checkout, informação de pagamento, resultado, compra e erros.
- Eventos padrão do GA4 mantidos junto dos eventos personalizados do funil.
- Core Web Vitals enviados ao GA4 com nome, valor e classificação, sem dados pessoais.
- UTMs e identificadores de clique permitidos preservados durante a sessão e ao avançar pela busca.
- Home com produto, localização, piscina, café da manhã, tipos de acomodação, avaliações e CTA comercial.
- Primeira dobra comercial com motor de busca, menor total real disponível, período e ocupação de referência.
- Até quatro acomodações reais exibidas na home com foto, capacidade, comodidades, total e acesso direto aos resultados.
- CTA móvel persistente sem cobrir o rodapé ou o botão de WhatsApp.
- Busca com validação de datas, hóspedes e idades, limite de tempo, retry e recuperação contextual pelo WhatsApp.
- Acomodação escolhida preservada entre catálogo e resultados.
- Resultados com fotos cadastradas, capacidade, comodidades cadastradas, quantidade de noites e valor total.
- Resultados compactados em duas colunas no desktop e uma no celular para facilitar comparação.
- Checkout em três etapas, resumo móvel, autocomplete, teclado apropriado e trava contra duplo envio.
- Retentativa de pagamento sem apagar dados do hóspede.
- Confirmação e evento `purchase` centralizados após retorno válido.
- FAQ limitado a informações comprovadas pelo motor.
- Conteúdo essencial visível sem depender de animação e fallback útil antes do JavaScript.
- Next.js, React, React DOM e Nodemailer atualizados para versões corrigidas.
- Layout validado em 1280×720 e 390×844 com banco temporário isolado.
- Nova home e novos resultados validados no build de produção em 1440 px e 390 px.

## Deliberadamente não publicado sem validação da administração

Os itens abaixo não são defeitos técnicos. São dados comerciais ou operacionais ausentes e não devem ser preenchidos por suposição:

- preço “a partir de” e processo responsável por mantê-lo atualizado;
- promessa de melhor tarifa ou benefício exclusivo da reserva direta;
- estacionamento, pets e condições para crianças;
- horários de check-in e check-out;
- distância até o centro ou outros pontos;
- camas, localização exata e limitações físicas de cada acomodação;
- condições de acesso a quartos, banheiros e áreas comuns;
- política aprovada de alteração, cancelamento, no-show e reembolso;
- condições fixas de parcelamento;
- SLA do atendimento por WhatsApp;
- identificação empresarial que deve aparecer no pagamento;
- slugs públicos das acomodações e regra para nomes duplicados.

O site não deve ser descrito como acessível. Qualquer informação sobre barreiras físicas depende de inspeção ou documentação formal.

## Dados necessários para liberar os itens pendentes

Para cada informação, registrar:

1. texto aprovado;
2. fonte (cadastro oficial, política assinada, inspeção ou confirmação formal);
3. responsável pela aprovação;
4. data da validação;
5. local do sistema que passa a ser a fonte oficial.

## Checklist de homologação e publicação

- [ ] Administração aprova os textos e fatos publicados.
- [ ] Política de cancelamento é fornecida e aprovada formalmente.
- [ ] Reserva real de valor controlado percorre busca, seleção, checkout, pagamento e confirmação.
- [ ] GA4 DebugView mostra um único `purchase` com ID, moeda e valor corretos.
- [ ] Google Ads recebe a conversão esperada sem duplicidade.
- [ ] E-mail e/ou WhatsApp de confirmação chegam com os dados corretos.
- [ ] Deploy é feito pela rotina oficial, sem executar migração de banco nesta entrega.
- [ ] Logs, erros de API e conversão mobile/desktop são acompanhados após a publicação.

## Rollback

Esta entrega não contém migração de banco. Em caso de regressão, reverter o deploy para o commit anterior à branch e manter o banco intacto.
