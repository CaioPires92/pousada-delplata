import Link from "next/link";
import { ChevronRight } from "lucide-react";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

interface BlogBreadcrumbsProps {
  items: BreadcrumbItem[];
  /** "light" para usar sobre foto escura. */
  tone?: "default" | "light";
}

export function BlogBreadcrumbs({ items, tone = "default" }: BlogBreadcrumbsProps) {
  const light = tone === "light";
  return (
    <nav aria-label="Breadcrumb" className={`text-sm ${light ? "text-white/75" : "text-muted-foreground"}`}>
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2">
              {item.href && !isLast ? (
                <Link className={`transition-colors ${light ? "hover:text-white" : "hover:text-primary"}`} href={item.href}>
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? (light ? "text-white" : "text-primary") : undefined}>{item.label}</span>
              )}
              {!isLast ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
