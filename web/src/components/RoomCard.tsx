'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Wifi, Tv, Wind, X, ChevronLeft, ChevronRight, Camera, Fan } from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';

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
    photos: RoomPhoto[];
}

interface RoomCardProps {
    room: Room;
    coverUrl: string;
}

export function RoomCard({ room, coverUrl }: RoomCardProps) {
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

    // Prepare photos array for gallery
    // If room has photos, use them. Otherwise use coverUrl as a single photo.
    const galleryPhotos = room.photos.length > 0 
        ? room.photos.map(p => p.url)
        : [coverUrl];

    const openGallery = () => {
        setCurrentPhotoIndex(0);
        setIsGalleryOpen(true);
    };

    const nextPhoto = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentPhotoIndex((prev) => (prev + 1) % galleryPhotos.length);
    };

    const prevPhoto = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentPhotoIndex((prev) => (prev - 1 + galleryPhotos.length) % galleryPhotos.length);
    };

    return (
        <>
            <Card className="group overflow-hidden hover:shadow-xl transition-all duration-300 border-2 hover:border-primary/50 flex flex-col h-full">
                <div 
                    className="relative h-64 overflow-hidden cursor-pointer"
                    onClick={openGallery}
                >
                    <Image
                        src={coverUrl}
                        alt={room.name}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    {/* Gallery Indicator */}
                    <div className="absolute bottom-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-2">
                        <Camera className="w-4 h-4" />
                        <span>Ver fotos ({galleryPhotos.length})</span>
                    </div>
                </div>

                <CardHeader>
                    <div className="flex justify-between items-start">
                        <CardTitle className="text-2xl font-heading group-hover:text-primary transition-colors">
                            {room.name}
                        </CardTitle>
                    </div>
                    <CardDescription className="text-base" style={{ whiteSpace: 'pre-line' }}>
                        {room.description}
                    </CardDescription>
                </CardHeader>

                <CardContent className="flex-grow">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                        <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>Até {room.capacity} pessoas</span>
                        </div>
                    </div>
                    <div className="flex gap-3 text-muted-foreground">
                        <Wifi className="w-4 h-4" />
                        <Tv className="w-4 h-4" />
                        {room.name === "Chalé" || room.name === "Apartamento Anexo" ? (
                            <Fan className="w-4 h-4" />
                        ) : (
                            <Wind className="w-4 h-4" />
                        )}
                    </div>
                </CardContent>

                <CardFooter className="flex items-center justify-between border-t pt-4 bg-muted/20 mt-auto">
                    <div>
                        <span className="text-xs text-muted-foreground block">A partir de</span>
                        <span className="text-xl font-bold text-primary">
                            R$ {Number(room.basePrice).toFixed(2)}
                        </span>
                    </div>
                    <Button asChild>
                        <Link href={`/reservar?roomTypeId=${room.id}`}>Reservar Agora</Link>
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
                                <Image
                                    src={galleryPhotos[currentPhotoIndex]}
                                    alt={`${room.name} photo ${currentPhotoIndex + 1}`}
                                    fill
                                    className="object-contain"
                                    priority
                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
                                />
                            </div>

                            {galleryPhotos.length > 1 && (
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
                                        {currentPhotoIndex + 1} / {galleryPhotos.length}
                                    </div>
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
