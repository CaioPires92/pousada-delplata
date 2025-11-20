import Link from "next/link";
import styles from "./Header.module.css";

export default function Header() {
    return (
        <header className={styles.header}>
            <div className={`container ${styles.container}`}>
                <Link href="/" className={styles.logo}>
                    Hotel Pousada Delplata
                </Link>
                <nav className={styles.nav}>
                    <Link href="/acomodacoes">Acomodações</Link>
                    <Link href="/lazer">Lazer</Link>
                    <Link href="/restaurante">Restaurante</Link>
                    <Link href="/contato">Contato</Link>
                    <Link href="/reservar" className="btn-primary">Reservar</Link>
                </nav>
            </div>
        </header>
    );
}
