import Image from "next/image";
import { LeisureCard } from "@/components/LeisureCard";

export const metadata = {
    title: 'Lazer | Pousada Delplata',
    description: 'Aproveite nossa área de lazer com piscinas, churrasqueiras, sala de jogos e muito mais.',
}

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
        description: 'Ampla piscina para adultos e área segura para as crianças se divertirem.',
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
        description: 'Drinks refrescantes e petiscos deliciosos para acompanhar seu dia de piscina.',
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
        description: 'Ambiente climatizado com TV a cabo, sofás e mesas de jogos para toda a família.',
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
        description: 'Área verde tranquila com redes para leitura e descanso relaxante.',
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
        title: '3 Churrasqueiras',
        description: 'Três espaços independentes e equipados para seu churrasco em família ou grupo.',
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
        title: 'Piscina Adulto',
        description: 'Piscina exclusiva para momentos de lazer na ala dos chalés e anexos.',
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
        title: 'Churrasqueira Privativa',
        description: 'Espaço gourmet reservado para os hóspedes da ala anexo.',
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
        <main className="min-h-screen bg-background pb-16">
            {/* Hero Section */}
            <section className="relative h-[40vh] min-h-[300px] flex items-center justify-center overflow-hidden mb-16">
                <div className="absolute inset-0">
                    <Image
                        src="/fotos/piscina-aptos/DJI_0845.jpg"
                        alt="Lazer Pousada Delplata"
                        fill
                        className="object-cover"
                        priority
                    />
                    <div className="absolute inset-0 bg-black/50" />
                </div>
                <div className="container relative z-10 text-center text-white space-y-4">
                    <h1 className="text-4xl md:text-5xl font-bold font-heading">
                        Lazer e Diversão
                    </h1>
                    <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto font-light">
                        Estrutura completa para o seu descanso em todas as alas.
                    </p>
                </div>
            </section>

            <div className="space-y-16">
                {/* Ala Principal Section */}
                <section className="container">
                    <div className="mb-10 border-b pb-4">
                        <h2 className="text-3xl md:text-4xl font-bold font-heading text-primary">Ala Principal</h2>
                        <p className="text-lg text-muted-foreground mt-2">
                            Piscina adulto e infantil, bar, jogos e muito verde.
                        </p>
                    </div>
                    {renderLeisureGrid(principalItems)}
                </section>

                {/* Ala Anexo Section */}
                <section className="container">
                    <div className="mb-10 border-b pb-4">
                        <h2 className="text-3xl md:text-4xl font-bold font-heading text-primary">Ala Chalés e Anexos</h2>
                        <p className="text-lg text-muted-foreground mt-2 flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full bg-secondary"></span>
                            Privacidade com piscina e churrasqueira exclusivas.
                        </p>
                    </div>
                    {renderLeisureGrid(annexItems)}
                </section>
            </div>
        </main>
    );
}
