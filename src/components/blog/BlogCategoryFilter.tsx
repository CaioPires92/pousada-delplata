import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { getCategoryPostCount } from "@/lib/blog";
import { BlogCategory } from "@/types/blog";

interface BlogCategoryFilterProps {
  categories: BlogCategory[];
  activeCategory?: string;
}

export function BlogCategoryFilter({
  categories,
  activeCategory,
}: BlogCategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <Link href="/blog">
        <Badge
          variant={!activeCategory ? "default" : "outline"}
          className="rounded-full border-primary/15 px-4 py-2 text-sm font-medium"
        >
          Todos os conteúdos
        </Badge>
      </Link>

      {categories.map((category) => {
        const isActive = category.slug === activeCategory;

        return (
          <Link key={category.slug} href={`/blog?category=${category.slug}`}>
            <Badge
              variant={isActive ? "secondary" : "outline"}
              className="rounded-full border-primary/15 px-4 py-2 text-sm font-medium"
            >
              {category.shortLabel}
              <span className="ml-2 text-xs opacity-80">
                {getCategoryPostCount(category)}
              </span>
            </Badge>
          </Link>
        );
      })}
    </div>
  );
}
