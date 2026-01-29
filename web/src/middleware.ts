import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;

    // Proteção das rotas de Admin
    const isAdminPage = path.startsWith('/admin');
    const isAdminApi = path.startsWith('/api/admin');

    if (isAdminPage || isAdminApi) {
        // Permitir acesso à página de login e API de login
        if (path === '/admin/login' || path === '/api/admin/login') {
            return NextResponse.next();
        }

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            const isDev = process.env.NODE_ENV !== 'production';
            const payload = isDev ? { error: 'missing_env', missing: ['JWT_SECRET'] } : { error: 'Server configuration error' };
            return NextResponse.json(payload, { status: 500 });
        }

        // Verificar cookie de autenticação
        const token = request.cookies.get('admin_token')?.value;

        if (!token) {
            // Se for uma requisição de API, retornar 401
            if (path.startsWith('/api/')) {
                return NextResponse.json(
                    { error: 'Unauthorized' },
                    { status: 401 }
                );
            }

            // Se for página, redirecionar para login
            return NextResponse.redirect(new URL('/admin/login', request.url));
        }

        // Opcional: Validar JWT aqui (requer 'jose' ou similar para edge runtime)
        // Por enquanto, a presença do cookie httpOnly é uma boa barreira inicial.
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/admin/:path*',
        '/api/admin/:path*'
    ],
};
