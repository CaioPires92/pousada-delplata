import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BlogCtaProps {
  title?: string;
  description?: string;
  compact?: boolean;
}

const WHATSAPP_URL =
  "https://wa.me/5519999654866?text=Ol%C3%A1!%20Vi%20o%20blog%20da%20Pousada%20Delplata%20e%20quero%20tirar%20uma%20d%C3%BAvida%20sobre%20a%20hospedagem.";

export function BlogCta({
  title = "Quer transformar a pesquisa em uma reserva direta?",
  description = "Se a Delplata fizer sentido para a sua viagem, consulte disponibilidade ou fale com a equipe pelo WhatsApp.",
  compact = false,
}: BlogCtaProps) {
  return (
    <section
      className={cn(
        "rounded-[28px] border border-primary/10 bg-white shadow-[0_16px_45px_rgba(40,50,35,0.08)]",
        compact ? "p-6" : "p-8 md:p-10",
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-6",
          compact ? "items-start" : "md:flex-row md:items-center md:justify-between",
        )}
      >
        <div className={cn("space-y-3", compact ? "w-full" : "max-w-2xl")}>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-secondary-foreground/80">
            Reserva direta
          </p>
          <h2
            className={cn(
              "font-bold font-heading text-primary text-balance",
              compact ? "max-w-[10ch] text-3xl leading-[1.02]" : "text-2xl md:text-3xl",
            )}
          >
            {title}
          </h2>
          <p
            className={cn(
              "leading-relaxed text-muted-foreground text-pretty",
              compact ? "max-w-[22ch] text-base" : "text-base",
            )}
          >
            {description}
          </p>
        </div>

        <div
          className={cn(
            "flex w-full flex-col gap-3",
            compact ? "items-stretch" : "md:w-auto",
          )}
        >
          <Button
            asChild
            size="lg"
            className={cn("h-11", compact ? "w-full" : "md:min-w-52")}
          >
            <Link href="/reservar">Ver disponibilidade</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className={cn("h-11", compact ? "w-full" : "md:min-w-52")}
          >
            <Link href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              Tirar dúvidas no WhatsApp
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
