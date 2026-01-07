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
        <main className="min-h-screen pt-24 pb-16 bg-white">
            <div className="container mx-auto px-4">
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold font-heading text-primary mb-4">
                        Restaurante
                    </h1>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                        Desfrute do nosso delicioso café da manhã servido diariamente em um ambiente 
                        amplo e aconchegante, preparado com carinho para começar bem o seu dia.
                    </p>
                </div>
                
                <RestaurantGallery images={restaurantImages} />
            </div>
        </main>
    );
}
