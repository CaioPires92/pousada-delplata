
import { Parallax } from 'react-parallax';

const imagemHero = '/assets/serra-negra-bg.jpg'; // Substituir por imagem real depois

export default function Home() {
  return (
    <div className="text-gray-800">
      <Parallax bgImage={imagemHero} strength={400}>
        <div className="h-[80vh] flex flex-col justify-center items-center text-white text-center bg-black/40 backdrop-brightness-75">
          <h1 className="text-4xl md:text-6xl font-bold drop-shadow-lg">Descubra a tranquilidade da Serra Negra</h1>
          <p className="mt-4 text-lg md:text-xl max-w-xl drop-shadow-md">
            Duas alas, uma experiência inesquecível na Pousada Delplata
          </p>
          <a href="/reservas" className="mt-6 px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-full shadow-md transition-all">
            Reservar Agora
          </a>
        </div>
      </Parallax>

      <section className="py-12 px-4 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-8">Conheça nossas alas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-6 border rounded-xl shadow hover:shadow-lg transition-all bg-white">
            <h3 className="text-xl font-semibold mb-2">Ala Principal</h3>
            <p>Ambiente tradicional, próxima à recepção. Ideal para quem busca comodidade e fácil acesso.</p>
          </div>
          <div className="p-6 border rounded-xl shadow hover:shadow-lg transition-all bg-white">
            <h3 className="text-xl font-semibold mb-2">Anexo</h3>
            <p>Mais reservado, perfeito para momentos de paz e silêncio. Acomodações confortáveis e tranquilas.</p>
          </div>
        </div>
      </section>

      <section className="py-12 bg-green-50 text-center">
        <h2 className="text-2xl font-bold mb-4">Escolha a sua estadia perfeita</h2>
        <p className="mb-6">Viva momentos únicos com conforto, natureza e hospitalidade.</p>
        <a href="/acomodacoes" className="px-6 py-3 bg-green-700 hover:bg-green-800 text-white rounded-full transition-all shadow">
          Ver Acomodações
        </a>
      </section>
    </div>
  );
}
