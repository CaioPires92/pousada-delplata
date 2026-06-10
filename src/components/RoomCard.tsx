'use client';

import { useState, Fragment } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Wifi, Tv, Wind, X, ChevronLeft, ChevronRight, Camera, Fan } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import { getLocalRoomPhotos } from '@/lib/room-photos';
import { gaEvent, trackClickReservar } from '@/lib/analytics';
import { getRoomAmenitiesList } from '@/lib/rooms';
 

interface RoomPhoto {
    id: string;
    url: string;
}

interface Room {
    id: string;
    name: string;
    description: string;
    capacity: number;
    basePrice: number;
    amenities?: string;
    photos: RoomPhoto[];
}

interface RoomCardProps {
    room: Room;
}

export function RoomCard({ room }: RoomCardProps) {
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
    const pathname = usePathname();

    const isPlaceholderUrl = (url: string) => {
        const normalizedUrl = url.trim().toLowerCase();
        const placeholderDomains = [
            'picsum.photos',
            'unsplash.com',
            'images.unsplash.com',
            'source.unsplash.com',
            'via.placeholder.com',
            'placeholder.com',
            'placehold.co',
        ];

        return placeholderDomains.some((domain) => normalizedUrl.includes(domain));
    };

    const backendPhotoUrls = (room.photos ?? [])
        .map((p) => p?.url?.trim())
        .filter((url): url is string => Boolean(url));

    const backendRealPhotoUrls = backendPhotoUrls.filter((url) => !isPlaceholderUrl(url));
    const hasBackendPhoto = backendRealPhotoUrls.length > 0;

    const localPhotos = !hasBackendPhoto ? getLocalRoomPhotos(room.name) : null;

    const displayPhotos = hasBackendPhoto ? backendRealPhotoUrls : (localPhotos || []);

    const hasPhoto = displayPhotos.length > 0;
    const primaryDisplayUrl = hasPhoto ? displayPhotos[0] : null;

    if (!hasPhoto && typeof window !== 'undefined') {
        console.warn(`[RoomCard] Missing photo for roomTypeId=${room.id} name="${room.name}" - No backend photos and no local mapping found`);
    }

    const openGallery = () => {
        setCurrentPhotoIndex(0);
        setIsGalleryOpen(true);
    };

    const nextPhoto = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentPhotoIndex((prev) => (prev + 1) % displayPhotos.length);
    };

    const prevPhoto = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentPhotoIndex((prev) => (prev - 1 + displayPhotos.length) % displayPhotos.length);
    };

    const handleReservarClick = () => {
        trackClickReservar(`room_card_${room.id}`);
        gaEvent('acomodacoes_cta_reservar_click', {
            source: 'room_card',
            room_id: room.id,
        });
    };

    const amenityList = getRoomAmenitiesList(room.amenities);

    const amenityIconMap: Array<{ icon: LucideIcon; match: (amenity: string) => boolean }> = [
        { icon: Wifi, match: (amenity) => amenity.includes('wifi') || amenity.includes('wi-fi') || amenity.includes('internet') },
        { icon: Tv, match: (amenity) => amenity.includes('tv') || amenity.includes('televis') },
        { icon: Wind, match: (amenity) => amenity.includes('ar-condicionado') || amenity.includes('ar condicionado') },
        { icon: Fan, match: (amenity) => amenity.includes('ventilador') },
    ];

    const amenityIcons = amenityList
        .map((amenity) => {
            const normalized = amenity.toLowerCase();
            const matched = amenityIconMap.find(({ match }) => match(normalized));
            return matched ? { amenity, Icon: matched.icon } : null;
        })
        .filter((item): item is { amenity: string; Icon: LucideIcon } => Boolean(item));

    return (
        <Fragment key={pathname}>
            <Card className="group flex h-full flex-col overflow-hidden rounded-none border border-primary/10 bg-white shadow-none transition-colors duration-200 hover:border-primary/20">
                <div
                    className="relative h-64 overflow-hidden cursor-pointer"
                    onClick={openGallery}
                >
                    {hasPhoto ? (
                        <Image
                            src={primaryDisplayUrl!}
                            alt={room.name}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 420px"
                            quality={76}
                            className="object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                            <span className="text-muted-foreground">Sem foto</span>
                        </div>
                    )}
                    {displayPhotos.length > 0 && (
                        <div className="absolute bottom-4 right-4 flex items-center gap-2 border border-white/20 bg-black/45 px-3 py-1 text-sm font-medium text-white backdrop-blur-sm">
                            <Camera className="w-4 h-4" />
                            <span>Ver fotos ({displayPhotos.length})</span>
                        </div>
                    )}
                </div>

                <CardHeader>
                    <div className="flex justify-between items-start">
                        <CardTitle className="font-sans text-[2rem] font-semibold leading-tight text-primary">
                            {room.name}
                        </CardTitle>
                    </div>
                    <CardDescription className="text-base leading-7 text-foreground/72" style={{ whiteSpace: 'pre-line' }}>
                        {room.description}
                    </CardDescription>
                </CardHeader>

                <CardContent className="flex-grow">
                    <div className="mb-4 flex items-center gap-4 text-sm text-foreground/72">
                        <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>Até {room.capacity} pessoas</span>
                        </div>
                    </div>
                    {amenityIcons.length > 0 ? (
                        <div className="mb-3 flex flex-wrap gap-3 text-[color:var(--brand-gold)]">
                            {amenityIcons.map(({ amenity, Icon }) => (
                                <Icon key={`${room.id}-${amenity}`} className="w-4 h-4" aria-label={amenity} />
                            ))}
                        </div>
                    ) : null}
                    {amenityList.length > 0 ? (
                        <p className="text-sm leading-6 text-foreground/72">
                            {amenityList.join(' • ')}
                        </p>
                    ) : null}
                </CardContent>

                <CardFooter className="mt-auto flex items-center justify-between border-t border-primary/10 bg-[color:var(--brand-cream)] pt-4">
                    <div>
                        <span className="text-sm font-medium text-foreground/72">
                            Valores variam conforme data e ocupação. Consulte disponibilidade.
                        </span>
                    </div>
                    <Button
                        asChild
                        className="h-11 rounded-none bg-primary px-5 text-sm font-semibold text-white shadow-none hover:bg-primary/90 hover:shadow-[0_8px_18px_rgba(9,9,9,0.08)]"
                    >
                        <Link href={`/reservar?roomTypeId=${room.id}`} onClick={handleReservarClick}>
                            Ver disponibilidade e preços
                        </Link>
                    </Button>
                </CardFooter>
            </Card>

            {/* Gallery Overlay */}
            <AnimatePresence>
                {isGalleryOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
                        onClick={() => setIsGalleryOpen(false)}
                    >
                        <button
                            onClick={() => setIsGalleryOpen(false)}
                            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors p-2 z-50"
                        >
                            <X className="w-8 h-8" />
                        </button>

                        <div className="relative w-full max-w-6xl h-[80vh]" onClick={(e) => e.stopPropagation()}>
                            <div className="relative w-full h-full flex items-center justify-center">
                                {displayPhotos.length > 0 ? (
                                    <Image
                                        src={displayPhotos[currentPhotoIndex]}
                                        alt={`${room.name} photo ${currentPhotoIndex + 1}`}
                                        fill
                                        className="object-contain"
                                        sizes="100vw"
                                        quality={84}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <span className="text-white/70">Sem fotos cadastradas</span>
                                    </div>
                                )}
                            </div>

                            {displayPhotos.length > 1 && (
                                <>
                                    <button
                                        onClick={prevPhoto}
                                        className="absolute left-0 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-r-lg transition-all backdrop-blur-sm"
                                    >
                                        <ChevronLeft className="w-8 h-8" />
                                    </button>
                                    <button
                                        onClick={nextPhoto}
                                        className="absolute right-0 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-l-lg transition-all backdrop-blur-sm"
                                    >
                                        <ChevronRight className="w-8 h-8" />
                                    </button>

                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 px-4 py-2 rounded-full text-white text-sm backdrop-blur-sm font-medium">
                                        {currentPhotoIndex + 1} / {displayPhotos.length}
                                    </div>
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Fragment>
    );
}
