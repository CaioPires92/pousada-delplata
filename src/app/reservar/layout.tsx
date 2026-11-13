import type { Metadata } from "next";
import Script from "next/script";

import { MERCADO_PAGO_SECURITY_SCRIPT_URL } from "@/lib/mercadopago/device-id";
import { buildPageMetadata } from "@/lib/seo";

const mercadoPagoSecurityAttributes = { view: "checkout" };

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
  return (
    <>
      <Script
        id="mercadopago-device-security"
        src={MERCADO_PAGO_SECURITY_SCRIPT_URL}
        strategy="afterInteractive"
        {...mercadoPagoSecurityAttributes}
      />
      {children}
    </>
  );
}
