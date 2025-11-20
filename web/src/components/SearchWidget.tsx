'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './SearchWidget.module.css';

export default function SearchWidget() {
    const router = useRouter();
    const [checkIn, setCheckIn] = useState('');
    const [checkOut, setCheckOut] = useState('');
    const [adults, setAdults] = useState('2');
    const [children, setChildren] = useState('0');

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!checkIn || !checkOut) {
            alert('Por favor, selecione as datas de check-in e check-out.');
            return;
        }

        const params = new URLSearchParams({
            checkIn,
            checkOut,
            adults,
            children
        });

        router.push(`/reservar?${params.toString()}`);
    };

    return (
        <div className={styles.widget}>
            <form onSubmit={handleSearch} className={styles.form}>
                <div className={styles.field}>
                    <label htmlFor="checkIn">Check-in</label>
                    <input
                        type="date"
                        id="checkIn"
                        value={checkIn}
                        onChange={(e) => setCheckIn(e.target.value)}
                        required
                        className={styles.input}
                    />
                </div>
                <div className={styles.field}>
                    <label htmlFor="checkOut">Check-out</label>
                    <input
                        type="date"
                        id="checkOut"
                        value={checkOut}
                        onChange={(e) => setCheckOut(e.target.value)}
                        required
                        className={styles.input}
                    />
                </div>
                <div className={styles.field}>
                    <label htmlFor="adults">Adultos</label>
                    <select
                        id="adults"
                        value={adults}
                        onChange={(e) => setAdults(e.target.value)}
                        className={styles.select}
                    >
                        {[1, 2, 3, 4, 5, 6].map(num => (
                            <option key={num} value={num}>{num}</option>
                        ))}
                    </select>
                </div>
                <div className={styles.field}>
                    <label htmlFor="children">Crianças</label>
                    <select
                        id="children"
                        value={children}
                        onChange={(e) => setChildren(e.target.value)}
                        className={styles.select}
                    >
                        {[0, 1, 2, 3, 4].map(num => (
                            <option key={num} value={num}>{num}</option>
                        ))}
                    </select>
                </div>
                <button type="submit" className={styles.button}>
                    Buscar Disponibilidade
                </button>
            </form>
        </div>
    );
}
