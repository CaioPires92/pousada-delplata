import AreaGrid from "@/components/AreaGrid";
import homeStyles from "@/components/home-novo/home-novo.module.css";
import PageHero from "@/components/home-novo/PageHero";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
    title: "Restaurante e café da manhã em Serra Negra | Pousada Delplata",
    description:
        "Conheça o restaurante e o café da manhã da Pousada Delplata em Serra Negra. Ambiente acolhedor para começar o dia com tranquilidade.",
    path: "/restaurante",
    image: "/fotos/restaurante/DSC_0002.jpg",
});

const R = '/fotos/restaurante/';
const group = (title: string, files: string[]) =>
    files.map((file, index) => ({ src: R + file, alt: `${title} (foto ${index + 1})`, caption: title }));

const AREAS = [
    {
        id: 'buffet',
        title: 'Buffet',
        description: 'Frios, frutas, quentes e tudo posto com capricho.',
        photos: group('Buffet do café da manhã', ['DSC_0002.jpg', 'DSC_0006.jpg', 'DSC_0007.jpg', 'DSC_0009.jpg', 'DSC_0010.jpg', 'IMG_0001.jpg', 'IMG_0009.jpg', 'IMG_0020.jpg', 'IMG_0024.jpg', 'IMG_0025.webp']),
    },
    {
        id: 'paes-bolos',
        title: 'Pães e bolos',
        description: 'Cestas de pães, bolos caseiros e doces.',
        photos: group('Pães e bolos', ['DSC_0011.jpg', 'DSC_0013.jpg', 'DSC_0018.jpg', 'DSC_0025.jpg', 'DSC_0026.jpg', 'DSC_0051.jpg', 'DSC_0052.jpg', 'IMG_0003.jpg', 'IMG_0012.jpg', 'IMG_0018.jpg']),
    },
    {
        id: 'mesa-posta',
        title: 'Mesa posta',
        description: 'Café, suco, frutas e pães na mesa, com vista.',
        photos: group('Mesa de café da manhã', ['DSC_0033.jpg', 'DSC_0035.jpg', 'DSC_0045.jpg', 'DSC_0053.jpg', 'DSC_0056.jpg', 'DSC_0060.jpg', 'DSC_0063.jpg', 'DSC_0068.jpg', 'DSC_0072.jpg', 'DSC_0074.jpg', 'DSC_0075.jpg', 'DSC_0076.jpg']),
    },
    {
        id: 'salao',
        title: 'Salão e vista',
        description: 'Ambiente aconchegante na Ala Principal.',
        photos: group('Salão do café da manhã', ['DSC_0082.jpg', 'DSC_0084.jpg', 'DSC_0094.jpg']),
    },
];

export default function RestaurantPage() {
    return (
        <main className="min-h-screen bg-background">
            <PageHero
                eyebrow="Restaurante"
                title={<>Café da <em>manhã</em></>}
                text="Comece seu dia com nosso delicioso café da manhã servido em um ambiente aconchegante e acolhedor."
                image="/fotos/restaurante/DSC_0002.jpg"
                imageAlt="Buffet do café da manhã da Pousada Delplata"
            />

            <section className="bg-[color:var(--brand-cream)] py-12 text-[color:var(--brand-forest)] md:py-16">
                <div className="container">
                    <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-10">
                        <div>
                            <p className={`${homeStyles.eyebrow} text-[color:var(--brand-forest)]`}>Todos os dias</p>
                            <h2 className={`${homeStyles.display} ${homeStyles.displayDark} mt-3 text-[clamp(1.9rem,4.6vw,3.8rem)]`}>
                                Feito com <em>carinho</em>
                            </h2>
                        </div>
                        <div className="max-w-[46ch] text-base leading-7 text-[color:var(--brand-forest)]/80">
                            <p>&ldquo;Preparados tudo com muito carinho para você e sua família.&rdquo;</p>
                            <p className="mt-1 font-semibold text-[color:var(--brand-forest)]">Horário: das 8:30h às 10:30h na Ala Principal</p>
                        </div>
                    </div>

                    <AreaGrid areas={AREAS} columns={2} />
                </div>
            </section>
        </main>
    );
}
