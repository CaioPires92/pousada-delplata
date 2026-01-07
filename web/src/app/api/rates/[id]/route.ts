import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await prisma.rate.delete({
            where: { id },
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting rate:', error);
        return NextResponse.json(
            { error: 'Error deleting rate' },
            { status: 500 }
        );
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const text = await request.text();
        if (!text) {
             return NextResponse.json(
                { error: 'Request body is empty' },
                { status: 400 }
            );
        }
        
        const body = JSON.parse(text);
        const { price, cta, ctd, stopSell, minLos } = body;

        const data: any = {};
        if (price !== undefined) data.price = parseFloat(price);
        if (cta !== undefined) data.cta = cta;
        if (ctd !== undefined) data.ctd = ctd;
        if (stopSell !== undefined) data.stopSell = stopSell;
        if (minLos !== undefined) data.minLos = parseInt(minLos);

        const rate = await prisma.rate.update({
            where: { id },
            data,
        });

        return NextResponse.json(rate);
    } catch (error) {
        console.error('Error updating rate:', error);
        return NextResponse.json(
            { error: 'Error updating rate' },
            { status: 500 }
        );
    }
}
