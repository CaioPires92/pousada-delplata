import Link from "next/link";
import { ChevronRight } from "lucide-react";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

interface BlogBreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function BlogBreadcrumbs({ items }: BlogBreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2">
              {item.href && !isLast ? (
                <Link className="transition-colors hover:text-primary" href={item.href}>
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? "text-primary" : undefined}>{item.label}</span>
              )}
              {!isLast ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
