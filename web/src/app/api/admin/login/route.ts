import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function POST(request: NextRequest) {
    try {
        const { email, password } = await request.json();

        console.log('[Admin Login] Attempt for:', email);

        // Buscar admin no banco
        const admin = await prisma.adminUser.findUnique({
            where: { email },
        });

        if (!admin) {
            console.log('[Admin Login] User not found');
            return NextResponse.json(
                { error: 'Email ou senha inválidos' },
                { status: 401 }
            );
        }

        // Verificar senha
        const isValidPassword = await bcrypt.compare(password, admin.password);

        if (!isValidPassword) {
            console.log('[Admin Login] Invalid password');
            return NextResponse.json(
                { error: 'Email ou senha inválidos' },
                { status: 401 }
            );
        }

        // Gerar token JWT
        const token = jwt.sign(
            {
                id: admin.id,
                email: admin.email,
                name: admin.name,
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log('[Admin Login] Success for:', email);

        return NextResponse.json({
            token,
            name: admin.name,
            email: admin.email,
        });

    } catch (error) {
        console.error('[Admin Login] Error:', error);
        return NextResponse.json(
            { error: 'Erro ao fazer login' },
            { status: 500 }
        );
    }
}
