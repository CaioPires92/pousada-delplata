import AreaPanels from "@/components/AreaPanels";
import PageHero from "@/components/home-novo/PageHero";
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
        description: 'Área comum da pousada para reunir a família com calma.',
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
        description: 'Área comum de churrasqueira da ala dos chalés e anexos.',
        images: [
            '/fotos/churrasqueira-chale/DJI_0920.jpg',
            '/fotos/churrasqueira-chale/DSC_0394.jpg',
            '/fotos/churrasqueira-chale/DSC_0396.jpg'
        ],
        wing: 'anexo'
    }
];

const WINGS = [
    {
        key: 'principal' as const,
        label: 'Ala principal',
        title: <>Ala <em>principal</em></>,
        text: 'Piscina adulto e infantil, bar, jogos e muito verde.',
    },
    {
        key: 'anexo' as const,
        label: 'Chalés e anexos',
        title: <>Chalés <em>e anexos</em></>,
        text: 'Privacidade com piscina e área comum de churrasqueira.',
    },
];

export default function LeisurePage() {
    return (
        <main className="min-h-screen bg-background">
            <PageHero
                eyebrow="Lazer"
                title={<>Lazer e <em>diversão</em></>}
                text="Estrutura completa para o seu descanso em todas as alas."
                image="/fotos/jardim-aptos/DJI_0896.jpg"
                imageAlt="Jardim da Pousada Delplata com balanço e gangorra, visto de cima"
            />

            {WINGS.map((wing, index) => {
                const areas = leisureItems
                    .filter((item) => item.wing === wing.key)
                    .map((item) => ({
                        id: item.id,
                        title: item.title,
                        description: item.description,
                        photos: item.images.map((src, photoIndex) => ({
                            src,
                            alt: `${item.title} (foto ${photoIndex + 1})`,
                            caption: `${item.title} · ${wing.label}`,
                        })),
                    }));

                return (
                    <AreaPanels
                        key={wing.key}
                        index={index}
                        total={WINGS.length}
                        title={wing.title}
                        text={wing.text}
                        areas={areas}
                        tone={index % 2 === 0 ? 'cream' : 'white'}
                        id={`ala-${index + 1}`}
                        next={WINGS[index + 1] ? { id: `ala-${index + 2}`, label: WINGS[index + 1].label } : undefined}
                    />
                );
            })}
        </main>
    );
}
