"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RestaurantGalleryProps {
    images: string[];
}

export function RestaurantGallery({ images }: RestaurantGalleryProps) {
    const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
    const pathname = usePathname();

    const openLightbox = (index: number) => setSelectedImageIndex(index);
    const closeLightbox = useCallback(() => setSelectedImageIndex(null), []);

    const handleNext = useCallback(() => {
        setSelectedImageIndex((prev) => (prev === null ? null : (prev + 1) % images.length));
    }, [images.length]);

    const handlePrev = useCallback(() => {
        setSelectedImageIndex((prev) => (prev === null ? null : (prev - 1 + images.length) % images.length));
    }, [images.length]);

    const nextImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        handleNext();
    };

    const prevImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        handlePrev();
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (selectedImageIndex === null) return;

            switch (e.key) {
                case "ArrowRight":
                    handleNext();
                    break;
                case "ArrowLeft":
                    handlePrev();
                    break;
                case "Escape":
                    closeLightbox();
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selectedImageIndex, handleNext, handlePrev, closeLightbox]);

    return (
        <Fragment key={pathname}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {images.map((src, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.05 }}
                        viewport={{ once: true }}
                        className="relative aspect-[4/3] cursor-pointer overflow-hidden border border-primary/10 bg-white transition-colors duration-200 hover:border-primary/20"
                        onClick={() => openLightbox(index)}
                    >
                        <Image
                            src={src}
                            alt={`Restaurante - Foto ${index + 1}`}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                            quality={74}
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-300 group-hover:bg-black/18">
                            <div className="scale-75 opacity-0 transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
                                <span className="border border-white/25 bg-black/40 px-4 py-2 font-medium text-white backdrop-blur-sm">
                                    Ver Foto
                                </span>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            <AnimatePresence>
                {selectedImageIndex !== null && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4"
                        onClick={closeLightbox}
                    >
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-4 right-4 z-50 rounded-none text-white hover:bg-white/20"
                            onClick={closeLightbox}
                        >
                            <X className="h-8 w-8" />
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute left-4 top-1/2 hidden h-12 w-12 -translate-y-1/2 rounded-none border border-white/20 text-white hover:bg-white/20 md:flex"
                            onClick={prevImage}
                        >
                            <ChevronLeft className="h-8 w-8" />
                        </Button>

                        <div className="relative w-full max-w-5xl h-[80vh]" onClick={(e) => e.stopPropagation()}>
                            <Image
                                src={images[selectedImageIndex]}
                                alt={`Restaurante - Foto ${selectedImageIndex + 1}`}
                                fill
                                className="object-contain"
                                sizes="100vw"
                                quality={84}
                            />
                        </div>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-4 top-1/2 hidden h-12 w-12 -translate-y-1/2 rounded-none border border-white/20 text-white hover:bg-white/20 md:flex"
                            onClick={nextImage}
                        >
                            <ChevronRight className="h-8 w-8" />
                        </Button>

                        <div className="absolute bottom-4 left-0 right-0 text-center text-white/80 text-sm">
                            {selectedImageIndex + 1} de {images.length}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Fragment>
    );
}
