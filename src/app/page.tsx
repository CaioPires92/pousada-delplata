import type { Metadata } from "next";

import HomeContent from "@/components/HomeContent";
import { buildPageMetadata } from "@/lib/seo";

// Esta linha força a página a ser dinâmica e evita o cache do build
export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildPageMetadata({
    title: "Pousada em Serra Negra com piscina e café da manhã | Pousada Delplata",
    description:
        "Hospede-se em Serra Negra com conforto, lazer para a família, café da manhã e reserva online no site oficial da Pousada Delplata.",
    path: "/",
    keywords: [
        "pousada em Serra Negra",
        "hotel em Serra Negra",
        "site oficial pousada Serra Negra",
        "pousada familiar em Serra Negra",
    ],
});

export default function HomePage() {
    return <HomeContent />;
}
