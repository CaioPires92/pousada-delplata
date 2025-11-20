import styles from "./Footer.module.css";

export default function Footer() {
    return (
        <footer className={styles.footer}>
            <div className={`container ${styles.container}`}>
                <div className={styles.column}>
                    <h3>Hotel Pousada Delplata</h3>
                    <p>Conforto e tranquilidade em meio à natureza.</p>
                </div>
                <div className={styles.column}>
                    <h4>Links Rápidos</h4>
                    <ul>
                        <li><a href="/acomodacoes">Acomodações</a></li>
                        <li><a href="/lazer">Lazer</a></li>
                        <li><a href="/contato">Contato</a></li>
                        <li><a href="/admin/login">Área Administrativa</a></li>
                    </ul>
                </div>
                <div className={styles.column}>
                    <h4>Contato</h4>
                    <p>reservas@delplata.com.br</p>
                    <p>(XX) XXXX-XXXX</p>
                </div>
            </div>
            <div className={styles.copyright}>
                <p>&copy; {new Date().getFullYear()} Hotel Pousada Delplata. Todos os direitos reservados.</p>
            </div>
        </footer>
    );
}
