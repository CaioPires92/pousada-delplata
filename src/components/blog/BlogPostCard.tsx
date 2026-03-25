import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatBlogDate, getBlogCategoryBySlug } from "@/lib/blog";
import { BlogPost } from "@/types/blog";

interface BlogPostCardProps {
  post: BlogPost;
}

export function BlogPostCard({ post }: BlogPostCardProps) {
  const category = getBlogCategoryBySlug(post.category);

  return (
    <article className="group overflow-hidden rounded-[28px] border border-primary/10 bg-white transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(40,50,35,0.08)]">
      <Link href={`/blog/${post.slug}`} className="block">
        <div className="relative aspect-[16/10] overflow-hidden bg-primary/5">
          <Image
            src={post.coverImage.src}
            alt={post.coverImage.alt}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-x-0 top-0 h-1 bg-secondary" />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/35 via-transparent to-transparent" />
        </div>
      </Link>

      <div className="space-y-4 p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          {category ? (
            <Badge variant="outline" className="rounded-full border-primary/15 px-3 py-1">
              {category.shortLabel}
            </Badge>
          ) : null}
        </div>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {formatBlogDate(post.publishedAt)} • {post.readingTime}
          </p>
          <h3 className="text-2xl font-bold font-heading leading-snug text-primary">
            <Link href={`/blog/${post.slug}`} className="hover:text-primary/85">
              {post.title}
            </Link>
          </h3>
          <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            {post.excerpt}
          </p>
        </div>

        <div className="flex items-end justify-between gap-4 border-t border-primary/10 pt-4">
          <div className="flex flex-wrap gap-2">
            {post.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-primary/5 px-3 py-1 text-xs font-medium text-primary/85"
              >
                {tag}
              </span>
            ))}
          </div>
          <Link
            href={`/blog/${post.slug}`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-transform hover:translate-x-1"
          >
            Ler
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}
