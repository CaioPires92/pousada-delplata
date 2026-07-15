import type { Metadata } from "next";
import Script from "next/script";
import { Suspense } from "react";

import Footer from "@/components/Footer";
import CampaignAttribution from "@/components/CampaignAttribution";
import Header from "@/components/Header";
import MobileBookingBar from "@/components/MobileBookingBar";
import ScrollToTopButton from "@/components/ScrollToTopButton";
import WhatsAppFloatingButton from "@/components/WhatsAppFloatingButton";
import {
  buildLodgingBusinessSchema,
  buildPageMetadata,
  buildWebSiteSchema,
  getSiteUrl,
} from "@/lib/seo";

import "./globals.css";

const structuredData = [buildWebSiteSchema(), buildLodgingBusinessSchema()];

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: "Pousada em Serra Negra com piscina e café da manhã | Pousada Delplata",
    description:
      "Reserve sua hospedagem em Serra Negra no site oficial da Pousada Delplata. Quartos para famílias, lazer, café da manhã e disponibilidade online.",
    path: "/",
    keywords: [
      "pousada em Serra Negra",
      "hotel em Serra Negra",
      "reserva de pousada em Serra Negra",
      "pousada com piscina em Serra Negra",
      "pousada com café da manhã em Serra Negra",
    ],
  }),
  metadataBase: new URL(getSiteUrl()),
  icons: {
    icon: "/fotos/logo.png",
    shortcut: "/fotos/logo.png",
    apple: "/fotos/logo.png",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const GA_MEASUREMENT_ID = "G-5YN158R31V";
const GOOGLE_ADS_ID = "AW-871445112";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "viz55o66pt");
          `}
        </Script>
      </head>
      <body className="font-sans antialiased">
        <Suspense fallback={null}>
          <CampaignAttribution />
        </Suspense>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GOOGLE_ADS_ID}');
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        <Header />
        {children}
        <Footer />
        <MobileBookingBar />
        <WhatsAppFloatingButton />
        <ScrollToTopButton />
      </body>
    </html>
  );
}
