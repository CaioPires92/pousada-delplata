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
  title,
  description,
  compact = false,
}: BlogCtaProps) {
  const resolvedTitle = title ?? (compact ? "Consultar datas" : "Consulte as datas da sua viagem");
  const resolvedDescription =
    description ?? (compact ? "Ou fale com a equipe pelo WhatsApp." : "Veja a disponibilidade ou fale com a equipe pelo WhatsApp.");

  return (
    <section
      className={cn(
        "border border-primary/10 bg-white",
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
          <p className="font-accent text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[color:var(--brand-gold)]">
            Reserva direta
          </p>
          <h2
            className={cn(
              "font-heading font-semibold text-primary text-balance",
              compact ? "max-w-[10ch] text-[2.2rem] leading-[0.98]" : "text-[2rem] leading-tight md:text-[2.6rem]",
            )}
          >
            {resolvedTitle}
          </h2>
          <p
            className={cn(
              "text-pretty leading-7 text-foreground/72",
              compact ? "max-w-[22ch] text-base" : "text-base",
            )}
          >
            {resolvedDescription}
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
            className={cn("h-11 rounded-none", compact ? "w-full" : "md:min-w-52")}
          >
            <Link href="/reservar">{compact ? "Consultar datas" : "Ver disponibilidade"}</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className={cn("h-11 rounded-none", compact ? "w-full" : "md:min-w-52")}
          >
            <Link href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              Falar no WhatsApp
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
