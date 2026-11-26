import Link from "next/link";

import { BlogCategory } from "@/types/blog";

interface BlogCategoryFilterProps {
  categories: BlogCategory[];
  activeCategory?: string;
}

const base = "inline-flex h-10 items-center border px-4 text-sm font-semibold transition-colors";
const active = "border-[color:var(--brand-forest)] bg-[color:var(--brand-forest)] text-white";
const idle = "border-[color:var(--brand-forest)]/25 text-[color:var(--brand-forest)] hover:border-[color:var(--brand-forest)]";

export function BlogCategoryFilter({ categories, activeCategory }: BlogCategoryFilterProps) {
  return (
    <nav aria-label="Categorias do blog" className="flex flex-wrap gap-2">
      <Link href="/blog" aria-current={!activeCategory ? "page" : undefined} className={`${base} ${!activeCategory ? active : idle}`}>
        Todos
      </Link>
      {categories.map((category) => (
        <Link
          key={category.slug}
          href={`/blog?category=${category.slug}`}
          aria-current={category.slug === activeCategory ? "page" : undefined}
          className={`${base} ${category.slug === activeCategory ? active : idle}`}
        >
          {category.shortLabel}
        </Link>
      ))}
    </nav>
  );
}
