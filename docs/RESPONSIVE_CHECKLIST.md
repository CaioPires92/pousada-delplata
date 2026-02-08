# Checklist de Responsividade

## Páginas
- `/reservar`
- `/admin/mapa`

## Viewports
- 375x667 (mobile)
- 768x1024 (tablet)
- 1280x800 (desktop)

## Itens a validar
- Calendário (datepicker) não ultrapassa a tela
- Modal de Edição em Lote não estoura a altura (scroll interno ok)
- Botões do modal não ficam colados no mobile
- Texto e inputs visíveis sem overflow horizontal

## Teste automatizado
Execute:
```
npm run test:responsive
```

Observação: o teste do `/admin/mapa` pode ser pulado se não houver sessão de admin.

## Artefatos
Screenshots são salvos em:
`web/.artifacts/responsive`
