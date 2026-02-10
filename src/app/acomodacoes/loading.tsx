import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

export default function Loading() {
    return (
        <main className="min-h-screen bg-background">
            {/* Hero Skeleton */}
            <div className="relative h-[40vh] min-h-[300px] bg-muted animate-pulse flex items-center justify-center">
                <div className="container text-center space-y-4">
                    <Skeleton className="h-12 w-3/4 md:w-1/2 mx-auto bg-white/20" />
                    <Skeleton className="h-6 w-full md:w-2/3 mx-auto bg-white/20" />
                </div>
            </div>

            {/* Grid Skeleton */}
            <section className="py-16 container">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {[1, 2, 3].map((i) => (
                        <Card key={i} className="overflow-hidden border-2">
                            <Skeleton className="h-64 w-full" />
                            <CardHeader className="space-y-2">
                                <Skeleton className="h-8 w-3/4" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-5/6" />
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Skeleton className="h-4 w-1/3" />
                                <div className="flex gap-3">
                                    <Skeleton className="h-4 w-4" />
                                    <Skeleton className="h-4 w-4" />
                                    <Skeleton className="h-4 w-4" />
                                </div>
                            </CardContent>
                            <CardFooter className="flex justify-between pt-4">
                                <div className="space-y-1">
                                    <Skeleton className="h-3 w-16" />
                                    <Skeleton className="h-6 w-24" />
                                </div>
                                <Skeleton className="h-10 w-32" />
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            </section>
        </main>
    );
}
