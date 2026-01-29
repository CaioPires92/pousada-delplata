"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, X, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

interface LeisureCardProps {
    title: string;
    description: string;
    images: string[];
}

export function LeisureCard({ title, description, images }: LeisureCardProps) {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const portalTarget = typeof document !== "undefined" ? document.body : null;

    const nextImage = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, [images.length]);

    const prevImage = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
    }, [images.length]);

    const openGallery = () => setIsGalleryOpen(true);
    const closeGallery = () => setIsGalleryOpen(false);

    // Keyboard navigation for gallery
    useEffect(() => {
        if (!isGalleryOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") closeGallery();
            if (e.key === "ArrowRight") nextImage();
            if (e.key === "ArrowLeft") prevImage();
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isGalleryOpen, nextImage, prevImage]);

    return (
        <>
            <Card 
                className="group overflow-hidden border-none shadow-lg rounded-3xl h-full flex flex-col cursor-pointer transition-transform hover:-translate-y-1"
                onClick={openGallery}
            >
                <div className="relative h-72 overflow-hidden bg-gray-100">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentImageIndex}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5 }}
                            className="absolute inset-0"
                        >
                            <Image
                                src={images[currentImageIndex]}
                                alt={`${title} - Imagem ${currentImageIndex + 1}`}
                                fill
                                className="object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                        </motion.div>
                    </AnimatePresence>

                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
                    
                    {/* Expand Icon Hint */}
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="bg-black/40 backdrop-blur-sm p-2 rounded-full text-white">
                            <Maximize2 className="w-5 h-5" />
                        </div>
                    </div>

                    {/* Navigation Arrows (Card) */}
                    {images.length > 1 && (
                        <div className="absolute inset-0 flex items-center justify-between p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="bg-black/20 hover:bg-black/40 text-white rounded-full h-8 w-8 backdrop-blur-sm"
                                onClick={prevImage}
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="bg-black/20 hover:bg-black/40 text-white rounded-full h-8 w-8 backdrop-blur-sm"
                                onClick={nextImage}
                            >
                                <ChevronRight className="h-5 w-5" />
                            </Button>
                        </div>
                    )}

                    {/* Dots Indicators */}
                    {images.length > 1 && (
                        <div className="absolute top-4 left-0 right-0 flex justify-center gap-1.5 pointer-events-none z-10">
                            {images.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`h-1.5 rounded-full transition-all duration-300 shadow-sm ${
                                        idx === currentImageIndex 
                                            ? "w-6 bg-white" 
                                            : "w-1.5 bg-white/50 backdrop-blur-sm"
                                    }`}
                                />
                            ))}
                        </div>
                    )}

                    <div className="absolute bottom-0 left-0 p-6 text-white w-full pointer-events-none">
                        <h3 className="text-xl font-bold font-heading mb-2">{title}</h3>
                        <p className="text-white/90 text-sm leading-relaxed line-clamp-3">{description}</p>
                    </div>
                </div>
            </Card>

            {/* Full Screen Gallery Modal */}
            {portalTarget && isGalleryOpen && createPortal(
                <AnimatePresence>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4 md:p-8"
                        onClick={closeGallery}
                    >
                        {/* Close Button */}
                        <button 
                            onClick={closeGallery}
                            className="absolute top-4 right-4 md:top-8 md:right-8 text-white/70 hover:text-white p-2 z-50"
                        >
                            <X className="w-8 h-8 md:w-10 md:h-10" />
                        </button>

                        {/* Main Image */}
                        <div 
                            className="relative w-full h-full max-w-7xl max-h-[85vh] flex items-center justify-center"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <motion.div
                                key={currentImageIndex}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.3 }}
                                className="relative w-full h-full"
                            >
                                <Image
                                    src={images[currentImageIndex]}
                                    alt={`${title} - Fullscreen ${currentImageIndex + 1}`}
                                    fill
                                    className="object-contain"
                                    priority
                                    quality={100}
                                />
                            </motion.div>

                            {/* Navigation Arrows (Modal) */}
                            {images.length > 1 && (
                                <>
                                    <button
                                        className="absolute left-0 md:-left-12 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white hover:scale-110 transition-all bg-black/20 md:bg-transparent rounded-full"
                                        onClick={prevImage}
                                    >
                                        <ChevronLeft className="w-10 h-10 md:w-12 md:h-12" />
                                    </button>
                                    <button
                                        className="absolute right-0 md:-right-12 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white hover:scale-110 transition-all bg-black/20 md:bg-transparent rounded-full"
                                        onClick={nextImage}
                                    >
                                        <ChevronRight className="w-10 h-10 md:w-12 md:h-12" />
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Caption / Counter */}
                        <div className="absolute bottom-4 left-0 right-0 text-center text-white/80 pointer-events-none">
                            <p className="text-lg font-bold mb-1">{title}</p>
                            {images.length > 1 && (
                                <p className="text-sm">
                                    {currentImageIndex + 1} / {images.length}
                                </p>
                            )}
                        </div>
                    </motion.div>
                </AnimatePresence>,
                portalTarget
            )}
        </>
    );
}
