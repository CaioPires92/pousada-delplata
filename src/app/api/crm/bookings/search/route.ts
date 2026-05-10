import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const query = searchParams.get("q");

        if (!query) {
            return NextResponse.json({ ok: true, bookings: [] });
        }

        const bookings = await prisma.booking.findMany({
            where: {
                OR: [
                    { guest: { name: { contains: query } } },
                    { guest: { email: { contains: query } } },
                    { guest: { phone: { contains: query } } },
                ]
            },
            include: {
                guest: true,
                roomType: true
            },
            orderBy: { checkIn: "desc" },
            take: 5
        });

        return NextResponse.json({ ok: true, bookings });
    } catch (error) {
        console.error("Erro ao buscar reservas:", error);
        return NextResponse.json({ ok: false, error: "Erro ao buscar reservas" }, { status: 500 });
    }
}
