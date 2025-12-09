## Diagnóstico
- O erro acontece porque o Next.js 16 valida a assinatura do segundo argumento dos Route Handlers do App Router. A assinatura anterior extraía `id` do `pathname`, evitando o segundo argumento, mas sua configuração exige o segundo argumento tipado como `{ params: { id: string } }`.
- Imports e tipos precisam estar alinhados com o App Router: usar `NextRequest` e `NextResponse` de `next/server` e o contexto com `{ params: { id: string } }`.

## Ajustes Propostos
- Trocar a assinatura para `export async function PUT(request: NextRequest, { params }: { params: { id: string } })`.
- Usar `id` a partir do `context.params.id` em vez de `pathname`.
- Manter conversões numéricas para `capacity`, `totalUnits` e `basePrice`.
- Garantir retorno com `NextResponse.json` e capturar erros.

## Arquivo Final (route.ts)
```ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const { id } = params
        const data = await request.json()

        const updatedRoom = await prisma.roomType.update({
            where: { id },
            data: {
                name: data.name,
                description: data.description,
                capacity: Number(data.capacity),
                totalUnits: Number(data.totalUnits),
                basePrice: Number(data.basePrice),
                amenities: data.amenities
            }
        })

        return NextResponse.json(updatedRoom)
    } catch (error) {
        console.error('[Admin Room Update] Error:', error)
        return NextResponse.json({ error: 'Erro ao atualizar quarto' }, { status: 500 })
    }
}
```

## Validações
- Tipos do primeiro e segundo argumentos compatíveis com Next.js 16.
- Sem reexports ou sintaxe inválida; função única `PUT` exportada.
- Conversões numéricas evitam erros de tipo no Prisma.

Confirme para eu aplicar esta versão ao arquivo e validar o build.