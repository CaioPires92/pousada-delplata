import Image from "next/image";
import { RestaurantGallery } from '@/components/RestaurantGallery';
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
    title: "Restaurante e café da manhã em Serra Negra | Pousada Delplata",
    description:
        "Conheça o restaurante e o café da manhã da Pousada Delplata em Serra Negra. Ambiente acolhedor para começar o dia com tranquilidade.",
    path: "/restaurante",
    image: "/fotos/restaurante/DSC_0002.jpg",
});

const restaurantImages = [
    '/fotos/restaurante/DSC_0002.jpg',
    '/fotos/restaurante/DSC_0006.jpg',
    '/fotos/restaurante/DSC_0007.jpg',
    '/fotos/restaurante/DSC_0009.jpg',
    '/fotos/restaurante/DSC_0010.jpg',
    '/fotos/restaurante/DSC_0011.jpg',
    '/fotos/restaurante/DSC_0013.jpg',
    '/fotos/restaurante/DSC_0018.jpg',
    '/fotos/restaurante/DSC_0025.jpg',
    '/fotos/restaurante/DSC_0026.jpg',
    '/fotos/restaurante/DSC_0033.jpg',
    '/fotos/restaurante/DSC_0035.jpg',
    '/fotos/restaurante/DSC_0045.jpg',
    '/fotos/restaurante/DSC_0051.jpg',
    '/fotos/restaurante/DSC_0052.jpg',
    '/fotos/restaurante/DSC_0053.jpg',
    '/fotos/restaurante/DSC_0056.jpg',
    '/fotos/restaurante/DSC_0060.jpg',
    '/fotos/restaurante/DSC_0063.jpg',
    '/fotos/restaurante/DSC_0068.jpg',
    '/fotos/restaurante/DSC_0072.jpg',
    '/fotos/restaurante/DSC_0074.jpg',
    '/fotos/restaurante/DSC_0075.jpg',
    '/fotos/restaurante/DSC_0076.jpg',
    '/fotos/restaurante/DSC_0082.jpg',
    '/fotos/restaurante/DSC_0084.jpg',
    '/fotos/restaurante/DSC_0094.jpg',
    '/fotos/restaurante/IMG_0001.jpg',
    '/fotos/restaurante/IMG_0003.jpg',
    '/fotos/restaurante/IMG_0009.jpg',
    '/fotos/restaurante/IMG_0012.jpg',
    '/fotos/restaurante/IMG_0018.jpg',
    '/fotos/restaurante/IMG_0020.jpg',
    '/fotos/restaurante/IMG_0024.jpg',
    '/fotos/restaurante/IMG_0025.webp'
];

export default function RestaurantPage() {
    return (
        <main className="min-h-screen bg-background">
            <section className="relative flex min-h-[42vh] items-center justify-center overflow-hidden bg-[color:var(--brand-black)]">
                <div className="absolute inset-0">
                    <Image
                        src="/fotos/restaurante/DSC_0002.jpg"
                        alt="Restaurante Pousada Delplata"
                        fill
                        className="object-cover object-center"
                        priority
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(40,50,35,0.78)_0%,rgba(40,50,35,0.52)_42%,rgba(9,9,9,0.24)_100%)]" />
                </div>

                <div className="container relative z-10 py-24 text-center text-white md:py-28">
                    <p className="font-accent text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[color:var(--brand-gold)]">
                        Restaurante
                    </p>
                    <h1 className="font-hero-display mt-4 text-[2.9rem] font-semibold leading-[0.96] md:text-[4rem]">
                        Restaurante e Café da Manhã
                    </h1>
                    <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-white/88 md:text-lg">
                        Comece seu dia com nosso delicioso café da manhã servido em um ambiente aconchegante e acolhedor.
                    </p>
                </div>
            </section>

            <section className="section-space-md bg-[color:var(--brand-cream)]">
            <div className="container">
                <div className="mb-12 space-y-4 text-center md:mb-16">
                    <p className="font-sans text-[1.9rem] font-semibold leading-tight text-primary md:text-[2.4rem]">
                        &ldquo;Preparados tudo com muito carinho para você e sua família.&rdquo;
                    </p>
                    <div className="inline-block border border-primary/10 bg-[color:var(--brand-white)] px-6 py-3">
                        <p className="font-sans font-medium text-primary">
                            Horário: das 8:30h às 10:30h na Ala Principal
                        </p>
                    </div>
                </div>

                <RestaurantGallery images={restaurantImages} />
            </div>
            </section>
        </main>
    );
}
