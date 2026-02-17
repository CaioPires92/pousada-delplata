import type { Metadata } from "next";
import { Open_Sans, Raleway, Poppins } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-open-sans",
  display: "swap",
});

const raleway = Raleway({
  subsets: ["latin"],
  variable: "--font-raleway",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hotel Pousada Delplata",
  description: "Reserve sua estadia no Hotel Pousada Delplata. Conforto e tranquilidade.",
  icons: {
    icon: "/fotos/logo.png",
    shortcut: "/fotos/logo.png",
    apple: "/fotos/logo.png",
  },
};

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppFloatingButton from "@/components/WhatsAppFloatingButton";
import ScrollToTopButton from "@/components/ScrollToTopButton";

const GA_MEASUREMENT_ID = "G-5YN158R31V";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${openSans.variable} ${raleway.variable} ${poppins.variable} font-sans antialiased`}
      >
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        <Header />
        {children}
        <Footer />
        <WhatsAppFloatingButton />
        <ScrollToTopButton />
      </body>
    </html>
  );
}
