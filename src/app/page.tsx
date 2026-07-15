import type { Metadata } from "next";
import { Suspense } from "react";

import HomeContent from "@/components/HomeContent";
import { buildPageMetadata } from "@/lib/seo";

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
    return (
        <Suspense fallback={<main className="min-h-screen bg-[color:var(--brand-cream)]" />}>
            <HomeContent />
        </Suspense>
    );
}
