import Link from "next/link";
import styles from "./home.module.css";
import SearchWidget from "@/components/SearchWidget";

export default function Home() {
  return (
    <main>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <h1>Bem-vindo ao Hotel Pousada Delplata</h1>
          <p>Conforto e tranquilidade para você e sua família.</p>
          <div className={styles.widgetWrapper}>
            <SearchWidget />
          </div>
        </div>
      </section>

      {/* Accommodations Preview */}
      <section className={`container ${styles.section}`}>
        <h2>Nossas Acomodações</h2>
        <div className={styles.grid3}>
          <div className={styles.card}>
            <h3>Apartamentos Térreo</h3>
            <p>Acessibilidade e conforto.</p>
            <Link href="/acomodacoes" className="btn-secondary">Ver Detalhes</Link>
          </div>
          <div className={styles.card}>
            <h3>Apartamentos Superior</h3>
            <p>Vista privilegiada e ar-condicionado.</p>
            <Link href="/acomodacoes" className="btn-secondary">Ver Detalhes</Link>
          </div>
          <div className={styles.card}>
            <h3>Chalés</h3>
            <p>Privacidade e contato com a natureza.</p>
            <Link href="/acomodacoes" className="btn-secondary">Ver Detalhes</Link>
          </div>
        </div>
      </section>

      {/* Leisure & Restaurant */}
      <section className={`container ${styles.section}`}>
        <div className={styles.grid2}>
          <div>
            <h2>Lazer</h2>
            <p>Piscina, área de churrasco e muito mais.</p>
          </div>
          <div>
            <h2>Restaurante</h2>
            <p>Delicioso café da manhã e refeições.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
