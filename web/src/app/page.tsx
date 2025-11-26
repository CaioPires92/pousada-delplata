import Link from "next/link";
import styles from "./home.module.css";
import SearchWidget from "@/components/SearchWidget";

export default function Home() {
  return (
    <main>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <h1>Uma das melhores opções em Serra Negra</h1>
          <p>Lazer e diversão para você e sua família.</p>
          <p>Conheça nossa região, encante-se!</p>
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
            <h3>Apartamento Térreo</h3>
            <p>Apartamentos compostos por: Televisão LCD 24, Frigobar, Guarda Roupa, Ventilador de Teto e Ar condicionado.</p>
            <Link href="/acomodacoes" className="btn-secondary">Ver Detalhes</Link>
          </div>
          <div className={styles.card}>
            <h3>Apartamento Superior</h3>
            <p>Apartamentos compostos por: Televisão LCD 24, Frigobar, Guarda Roupa, Ventilador de Teto e Ar condicionado.</p>
            <Link href="/acomodacoes" className="btn-secondary">Ver Detalhes</Link>
          </div>
          <div className={styles.card}>
            <h3>Chalés</h3>
            <p>Chalés para até 4 pessoas, compostos por: Tv 20, Frigobar, Guarda roupas e Ventilador de teto.</p>
            <Link href="/acomodacoes" className="btn-secondary">Ver Detalhes</Link>
          </div>
        </div>
      </section>

      {/* Leisure & Restaurant */}
      <section className={`container ${styles.section}`}>
        <div className={styles.grid2}>
          <div>
            <h2>Lazer para todos os gostos</h2>
            <p>Pensando no seu bem estar o Hotel Pousada Delplata oferece o melhor para o seu lazer</p>
          </div>
          <div>
            <h2>Café da manhã servido em um agradável ambiente</h2>
            <p>Preparados tudo com muito carinho para você e sua família.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
