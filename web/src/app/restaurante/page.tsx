import Image from "next/image";
import { Metadata } from 'next';
import { RestaurantGallery } from '@/components/RestaurantGallery';

export const metadata: Metadata = {
    title: 'Restaurante e Café da Manhã | Pousada Delplata',
    description: 'Comece seu dia com nosso delicioso café da manhã servido em um ambiente aconchegante e acolhedor.',
};

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
        <main className="min-h-screen bg-white">
            {/* Hero Section */}
            <section className="relative h-[40vh] min-h-[300px] flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0">
                    <Image
                        src="/fotos/restaurante/DSC_0002.jpg"
                        alt="Restaurante Pousada Delplata"
                        fill
                        className="object-cover"
                        priority
                    />
                    <div className="absolute inset-0 bg-black/50" />
                </div>

                <div className="container relative z-10 text-center text-white space-y-4">
                    <h1 className="text-4xl md:text-5xl font-bold font-heading">
                        Restaurante e Café da Manhã
                    </h1>
                    <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto font-light">
                        Comece seu dia com nosso delicioso café da manhã servido em um ambiente aconchegante e acolhedor.
                    </p>
                </div>
            </section>

            <div className="container mx-auto px-4 py-16">
                <div className="text-center mb-12 space-y-4">
                    <p className="text-xl md:text-2xl text-gray-700 font-light italic">
                        &ldquo;Preparados tudo com muito carinho para você e sua família.&rdquo;
                    </p>
                    <div className="inline-block bg-primary/5 px-6 py-3 rounded-full">
                        <p className="text-primary font-medium">
                            Horário: das 8:30h às 10:30h na Ala Principal
                        </p>
                    </div>
                </div>

                <RestaurantGallery images={restaurantImages} />
            </div>
        </main>
    );
}
