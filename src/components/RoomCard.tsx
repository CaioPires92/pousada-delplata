'use client';

import { useState, Fragment } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, Camera } from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import { getLocalRoomPhotos } from '@/lib/room-photos';
import { gaEvent, trackClickReservar } from '@/lib/analytics';
import { getRoomAmenitiesList } from '@/lib/rooms';
import { roomAcceptsPets } from '@/lib/pet-policy';
import homeStyles from '@/components/home-novo/home-novo.module.css';
 

interface RoomPhoto {
    id: string;
    url: string;
}

interface Room {
    id: string;
    name: string;
    description: string;
    capacity: number;
    maxGuests?: number;
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

    return (
        <Fragment key={pathname}>
            <Card className="group grid overflow-hidden rounded-none border border-primary/10 bg-white shadow-none transition-colors duration-200 hover:border-primary/30 md:grid-cols-[340px_minmax(0,1fr)_250px]">
                <div
                    className="relative aspect-[16/10] cursor-zoom-in overflow-hidden bg-[color:var(--brand-cream)] md:aspect-auto md:min-h-[200px]"
                    role="button"
                    tabIndex={hasPhoto ? 0 : undefined}
                    aria-label={hasPhoto ? `Ver fotos (${displayPhotos.length}): ${room.name}` : undefined}
                    onClick={openGallery}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openGallery();
                        }
                    }}
                >
                    {hasPhoto ? (
                        <Image
                            src={primaryDisplayUrl!}
                            alt={room.name}
                            fill
                            sizes="(max-width: 767px) 100vw, 340px"
                            quality={85}
                            className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted">
                            <span className="text-muted-foreground">Sem foto</span>
                        </div>
                    )}
                    {displayPhotos.length > 0 && (
                        <div className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 bg-[rgba(40,50,35,0.9)] px-2.5 py-1 text-[0.7rem] font-semibold text-white">
                            <Camera className="h-3 w-3" />
                            <span>Ver fotos ({displayPhotos.length})</span>
                        </div>
                    )}
                </div>

                <div className="flex min-w-0 flex-col justify-center gap-2 p-4 md:p-5">
                    <h3 className={`${homeStyles.display} ${homeStyles.displayDark} text-[clamp(1.4rem,2vw,1.9rem)] text-primary`}>
                        {room.name}
                    </h3>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/70">
                        {room.capacity} hóspedes{room.maxGuests && room.maxGuests > room.capacity ? ` · até ${room.maxGuests} em quartos selecionados` : ''} · {roomAcceptsPets(room.name) ? 'aceita pets' : 'sem pets'}
                    </p>
                    <p className="line-clamp-2 text-sm leading-6 text-foreground/75" style={{ whiteSpace: 'pre-line' }}>
                        {room.description}
                    </p>
                    {amenityList.length > 0 ? (
                        <p className="text-sm text-foreground/75">{amenityList.slice(0, 5).join(' · ')}</p>
                    ) : null}
                </div>

                <div className="flex flex-col justify-center gap-2 border-t border-primary/10 p-4 md:border-l md:border-t-0">
                    <p className="text-xs leading-5 text-foreground/70">Valores variam conforme data e ocupação.</p>
                    <Button
                        asChild
                        className="h-11 w-full rounded-none bg-[color:var(--brand-gold)] px-4 text-[0.78rem] font-bold uppercase tracking-[0.06em] text-[color:var(--brand-forest)] shadow-none hover:opacity-90"
                    >
                        <Link href={`/reservar?roomTypeId=${room.id}`} onClick={handleReservarClick}>
                            Ver preços
                        </Link>
                    </Button>
                    <Link href={`/acomodacoes/${room.id}`} className="text-center text-xs font-bold uppercase tracking-[0.14em] text-primary underline underline-offset-4">
                        Ver detalhes
                    </Link>
                </div>
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
