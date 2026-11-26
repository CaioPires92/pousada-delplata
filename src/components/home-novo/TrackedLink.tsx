"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { trackClickReservarFinal, trackClickWhatsAppFinal } from "@/lib/analytics";

type TrackedLinkProps = {
  href: string;
  className?: string;
  track: "reservar_final" | "whatsapp_final";
  external?: boolean;
  children: ReactNode;
};

export default function TrackedLink({ href, className, track, external = false, children }: TrackedLinkProps) {
  const onClick = () => {
    if (track === "reservar_final") trackClickReservarFinal("final");
    else trackClickWhatsAppFinal("final");
  };

  return (
    <Link
      href={href}
      className={className}
      onClick={onClick}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </Link>
  );
}
