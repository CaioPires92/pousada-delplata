import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/admin-auth'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAdminAuth()
        if (auth instanceof Response) return auth

        const { id } = await params
        const data = await request.json()

        const existingRoom = await prisma.roomType.findUnique({
            where: { id },
            select: { basePrice: true }
        })

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

        if (existingRoom && Number(existingRoom.basePrice) !== Number(data.basePrice)) {
            await prisma.rate.updateMany({
                where: {
                    roomTypeId: id,
                    price: Number(existingRoom.basePrice),
                    stopSell: false,
                    cta: false,
                    ctd: false,
                    minLos: 1
                },
                data: {
                    price: Number(data.basePrice)
                }
            })
        }

        return NextResponse.json(updatedRoom)
    } catch (error) {
        console.error('[Admin Room Update] Error:', error)
        return NextResponse.json({ error: 'Erro ao atualizar quarto' }, { status: 500 })
    }
}
