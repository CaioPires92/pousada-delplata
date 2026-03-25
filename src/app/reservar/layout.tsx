import type { Metadata } from "next";

import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Reserva online em Serra Negra | Pousada Delplata",
  description:
    "Consulte disponibilidade, compare opções de hospedagem e finalize sua reserva online na Pousada Delplata em Serra Negra.",
  path: "/reservar",
  keywords: [
    "reserva online em Serra Negra",
    "motor de reservas pousada",
    "disponibilidade pousada Serra Negra",
  ],
});

export default function ReservarLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
