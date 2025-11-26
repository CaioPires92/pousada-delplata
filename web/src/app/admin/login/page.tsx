'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';

export default function AdminLoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Erro ao fazer login');
            }

            const data = await response.json();

            // Salvar token no localStorage
            localStorage.setItem('admin_token', data.token);
            localStorage.setItem('admin_name', data.name);

            // Redirecionar para dashboard
            router.push('/admin/dashboard');
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.loginBox}>
                <div className={styles.logo}>
                    <h1>🏨 Pousada Delplata</h1>
                    <p>Painel Administrativo</p>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <h2>Login</h2>

                    {error && (
                        <div className={styles.error}>
                            {error}
                        </div>
                    )}

                    <div className={styles.formField}>
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={loading}
                            placeholder="admin@delplata.com.br"
                        />
                    </div>

                    <div className={styles.formField}>
                        <label htmlFor="password">Senha</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={loading}
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        className={styles.submitButton}
                        disabled={loading}
                    >
                        {loading ? 'Entrando...' : 'Entrar'}
                    </button>

                    <div className={styles.hint}>
                        <small>
                            💡 Credenciais padrão:<br />
                            Email: admin@delplata.com.br<br />
                            Senha: admin123
                        </small>
                    </div>
                </form>
            </div>
        </div>
    );
}
