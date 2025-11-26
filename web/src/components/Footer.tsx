import styles from "./Footer.module.css";

export default function Footer() {
    return (
        <footer className={styles.footer}>
            <div className={`container ${styles.container}`}>
                <div className={styles.column}>
                    <h3>Hotel Pousada Delplata</h3>
                    <p>O Hotel Pousada Delplata é um local tranquilo e rodeado de muita natureza, ambiente ideal para descansar, sair da rotina e renovar as energias.</p>
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
                    <p>R. Vicente Frederico Leporas, 151</p>
                    <p>Bairro das Posses, Serra Negra - SP, 13930-000</p>
                    <p>Telefone: (19) 3842-2559</p>
                    <p>WhatsApp: (19) 99965-4866</p>
                    <p>E-mail: contato@pousadadelplata.com.br</p>
                </div>
            </div>
            <div className={styles.copyright}>
                <p>&copy; {new Date().getFullYear()} Hotel Pousada Delplata. Todos os direitos reservados.</p>
            </div>
        </footer>
    );
}
