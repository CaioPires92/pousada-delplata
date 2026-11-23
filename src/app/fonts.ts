import { Bodoni_Moda, Inter } from "next/font/google";

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
