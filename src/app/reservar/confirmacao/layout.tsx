import type { Metadata } from "next";

import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Confirmação da reserva | Pousada Delplata",
  description: "Página de confirmação da reserva da Pousada Delplata.",
  path: "/reservar/confirmacao",
  noIndex: true,
});

export default function ConfirmacaoLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
