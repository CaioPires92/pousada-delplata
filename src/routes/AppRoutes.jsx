import { Routes, Route } from 'react-router-dom';
import Home from '../pages/Home';
import Sobre from '../pages/Sobre';
import Acomodacoes from '../pages/Acomodacoes';
import Galeria from '../pages/Galeria';
import SerraNegra from '../pages/SerraNegra';
import FAQ from '../pages/FAQ';
import Contato from '../pages/Contato';
import Blog from '../pages/Blog';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/sobre" element={<Sobre />} />
      <Route path="/acomodacoes" element={<Acomodacoes />} />
      <Route path="/galeria" element={<Galeria />} />
      <Route path="/serranegra" element={<SerraNegra />} />
      <Route path="/faq" element={<FAQ />} />
      <Route path="/contato" element={<Contato />} />
      <Route path="/blog" element={<Blog />} />
    </Routes>
  );
}