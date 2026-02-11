import HomeContent from "@/components/HomeContent";

// Esta linha força a página a ser dinâmica e evita o cache do build
export const dynamic = 'force-dynamic';

export default function HomePage() {
    return <HomeContent />;
}
// Teste CI/CD