"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PromoWeekendCardProps = {
  className?: string;
};

export default function PromoWeekendCard({ className }: PromoWeekendCardProps) {
  return (
    <Card
      className={cn(
        "space-y-3 rounded-xl border border-primary/10 bg-white p-5 shadow-xl transition-all duration-300 hover:shadow-2xl",
        className
      )}
    >
      <Badge variant="secondary" className="bg-primary text-xs text-white hover:bg-primary">
        Oferta especial
      </Badge>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground">Fim de semana em Serra Negra</h3>
        <p className="text-sm text-muted-foreground">
          Reserve direto no site e aproveite uma condição exclusiva.
        </p>
      </div>

      <p className="text-3xl font-bold text-primary">ATÉ 15% OFF</p>
      <p className="text-sm font-medium text-muted-foreground">Desconto aplicado automaticamente</p>

      <Button asChild variant="default" className="h-11 w-full rounded-lg bg-primary hover:bg-primary/90">
        <Link href="/reservar" aria-label="Ver disponibilidade com promoção de fim de semana">
          Ver disponibilidade
        </Link>
      </Button>

      <p className="text-xs text-muted-foreground">Válido até domingo</p>
    </Card>
  );
}
