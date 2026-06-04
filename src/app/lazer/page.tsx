import Image from "next/image";
import { LeisureCard } from "@/components/LeisureCard";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
    title: "Lazer com piscina e área de descanso | Pousada Delplata",
    description:
        "Veja a estrutura de lazer da Pousada Delplata em Serra Negra, com piscinas, churrasqueiras, jardim, sala de jogos e espaços para famílias.",
    path: "/lazer",
    image: "/fotos/piscina-aptos/DJI_0845.jpg",
});

interface LeisureItem {
    id: string;
    title: string;
    description: string;
    images: string[];
    wing: 'principal' | 'anexo';
}

const leisureItems: LeisureItem[] = [
    // Ala Principal
    {
        id: 'piscina-principal',
        title: 'Piscina Adulto e Infantil',
        description: 'Lazer para todas as idades.',

        images: [
            '/fotos/piscina-aptos/DJI_0845.jpg',
            '/fotos/piscina-aptos/DJI_0863.jpg',
            '/fotos/piscina-aptos/DJI_0864.jpg',
            '/fotos/piscina-aptos/DJI_0900.jpg',
            '/fotos/piscina-aptos/DSC_0229.jpg',
            '/fotos/piscina-aptos/DSC_0235.jpg',
            '/fotos/piscina-aptos/DSC_0241.jpg',
            '/fotos/piscina-aptos/DSC_0252.jpg'
        ],
        wing: 'principal'
    },
    {
        id: 'snack-bar',
        title: 'Snack Bar',
        description: 'Drinks e petiscos ao lado da piscina.',
        images: [
            '/fotos/bar-principal/DSC_0276.jpg',
            '/fotos/bar-principal/DSC_0351.jpg',
            '/fotos/bar-principal/DSC_0349.jpg',
            '/fotos/bar-principal/DJI_0893.jpg',
            '/fotos/bar-principal/DSC_0256.jpg',
            '/fotos/bar-principal/porcoes/DSC_0283.jpg',
            '/fotos/bar-principal/porcoes/DSC_0300.jpg',
            '/fotos/bar-principal/porcoes/DSC_0321.jpg'
        ],
        wing: 'principal'
    },
    {
        id: 'sala-jogos',
        title: 'Sala de Jogos e TV',
        description: 'Sinuca, pebolim, TV e tempo de descanso.',
        images: [
            '/fotos/Sala de jogos/DSC_0228.jpg',
            '/fotos/Sala de jogos/DSC_0232.jpg',
            '/fotos/Sala de jogos/DSC_0333.jpg',
            '/fotos/Sala de jogos/DSC_0334.jpg',
            '/fotos/Sala de jogos/DSC_0335.jpg',
            '/fotos/Sala de jogos/DSC_0337.jpg',
            '/fotos/Sala de jogos/DSC_0339.jpg',
            '/fotos/Sala de jogos/DSC_0341.jpg',
            '/fotos/Sala de jogos/DSC_0346.jpg'
        ],
        wing: 'principal'
    },
    {
        id: 'jardim-redes',
        title: 'Jardim com Redes',
        description: 'Verde, redes e descanso sem pressa.',
        images: [
            '/fotos/jardim-aptos/DSC_0258.jpg',
            '/fotos/jardim-aptos/DSC_0262.jpg',
            '/fotos/jardim-aptos/DSC_0267.jpg',
            '/fotos/jardim-aptos/DSC_0275.jpg',
            '/fotos/jardim-aptos/DJI_0889.jpg',
            '/fotos/jardim-aptos/DJI_0904.jpg',
            '/fotos/jardim-aptos/IMG_0137.jpg',
            '/fotos/jardim-aptos/IMG_0138.jpg'
        ],
        wing: 'principal'
    },
    {
        id: 'churrasqueiras-principal',
        title: 'Churrasqueiras',
        description: 'Espaço para reunir a família com calma.',
        images: [
            '/fotos/churrasqueira-aptos/DSC_0269.jpg',
            '/fotos/churrasqueira-aptos/DSC_0273.jpg',
            '/fotos/churrasqueira-aptos/DJI_0902.jpg'
        ],
        wing: 'principal'
    },

    // Ala Anexo
    {
        id: 'piscina-anexo',
        title: 'Piscina',
        description: 'Piscina da ala dos chalés e anexos.',
        images: [
            '/fotos/piscina-chale/DJI_0916.jpg',
            '/fotos/piscina-chale/DJI_0917.jpg',
            '/fotos/piscina-chale/DJI_0918.jpg',
            '/fotos/piscina-chale/DSC_0370.jpg',
            '/fotos/piscina-chale/DSC_0371.jpg',
            '/fotos/piscina-chale/DSC_0374.jpg',
            '/fotos/piscina-chale/DSC_0376.jpg',
            '/fotos/piscina-chale/DSC_0378.jpg',
            '/fotos/piscina-chale/DSC_0380.jpg'
        ],
        wing: 'anexo'
    },
    {
        id: 'churrasqueira-anexo',
        title: 'Churrasqueira',
        description: 'Churrasqueira reservada para a ala anexo.',
        images: [
            '/fotos/churrasqueira-chale/DJI_0920.jpg',
            '/fotos/churrasqueira-chale/DSC_0394.jpg',
            '/fotos/churrasqueira-chale/DSC_0396.jpg'
        ],
        wing: 'anexo'
    }
];

export default function LeisurePage() {
    const principalItems = leisureItems.filter(item => item.wing === 'principal');
    const annexItems = leisureItems.filter(item => item.wing === 'anexo');

    const renderLeisureGrid = (items: LeisureItem[]) => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {items.map((item) => (
                <LeisureCard
                    key={item.id}
                    title={item.title}
                    description={item.description}
                    images={item.images}
                />
            ))}
        </div>
    );

    return (
        <main className="min-h-screen bg-background">
            <section className="relative flex min-h-[42vh] items-center justify-center overflow-hidden bg-[color:var(--brand-black)]">
                <div className="absolute inset-0">
                    <Image
                        src="/fotos/piscina-aptos/DJI_0845.jpg"
                        alt="Lazer Pousada Delplata"
                        fill
                        className="object-cover object-center"
                        priority
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(40,50,35,0.72)_0%,rgba(40,50,35,0.52)_42%,rgba(9,9,9,0.26)_100%)]" />
                </div>
                <div className="container relative z-10 py-24 text-center text-white md:py-28">
                    <div className="mx-auto max-w-3xl px-6 py-8 md:px-10">
                        <p className="font-accent text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[color:var(--brand-gold)] [text-shadow:0_2px_12px_rgba(0,0,0,0.45)]">
                            Lazer
                        </p>
                        <h1 className="font-hero-display mt-4 text-[2.9rem] font-semibold leading-[0.96] text-white [text-shadow:0_2px_22px_rgba(0,0,0,0.58)] md:text-[4rem]">
                            Lazer e Diversão
                        </h1>
                        <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.52)] md:text-lg">
                            Estrutura completa para o seu descanso em todas as alas.
                        </p>
                    </div>
                </div>
            </section>

            <div className="space-y-0">
                {/* Ala Principal Section */}
                <section className="section-space-md bg-[color:var(--brand-cream)]">
                    <div className="container">
                    <div className="mb-10 border-b border-primary/10 pb-4">
                        <h2 className="font-hero-display text-[2.2rem] font-semibold leading-tight text-primary md:text-[3rem]">Ala Principal</h2>
                        <p className="mt-2 text-[1.02rem] leading-7 text-foreground/72">
                            Piscina adulto e infantil, bar, jogos e muito verde.
                        </p>
                    </div>
                    {renderLeisureGrid(principalItems)}
                    </div>
                </section>

                {/* Ala Anexo Section */}
                <section className="section-space-md bg-background">
                    <div className="container">
                    <div className="mb-10 border-b border-primary/10 pb-4">
                        <h2 className="font-hero-display text-[2.2rem] font-semibold leading-tight text-primary md:text-[3rem]">Ala Chalés e Anexos</h2>
                        <p className="mt-2 flex items-center gap-2 text-[1.02rem] leading-7 text-foreground/72">
                            <span className="inline-block w-2 h-2 rounded-full bg-secondary"></span>
                            Privacidade com piscina e churrasqueira.
                        </p>
                    </div>
                    {renderLeisureGrid(annexItems)}
                    </div>
                </section>
            </div>
        </main>
    );
}
