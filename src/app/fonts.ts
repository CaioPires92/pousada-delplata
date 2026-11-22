import { Bodoni_Moda, Bricolage_Grotesque, Inter, Instrument_Serif } from "next/font/google";

// Fontes servidas pelo próprio site (next/font baixa no build e hospeda em /_next/static):
// sem requisição ao Google no navegador e sem troca de fonte entre aparelhos.
export const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const bodoniModa = Bodoni_Moda({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-playfair-display",
});

// Modelo do novo layout (inspirado na Pousada Paraíso): display grotesca em caixa alta
// com ênfase em serifa itálica.
export const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-bricolage",
});

export const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-instrument",
});
