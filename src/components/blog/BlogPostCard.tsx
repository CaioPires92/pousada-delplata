import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { formatBlogDate, getBlogCategoryBySlug } from "@/lib/blog";
import { BlogPost } from "@/types/blog";

interface BlogPostCardProps {
  post: BlogPost;
}

export function BlogPostCard({ post }: BlogPostCardProps) {
  const category = getBlogCategoryBySlug(post.category);

  return (
    <article className="group flex h-full flex-col overflow-hidden bg-white">
      <Link href={`/blog/${post.slug}`} className="relative block aspect-[16/10] overflow-hidden bg-[color:var(--brand-forest)]" tabIndex={-1} aria-hidden="true">
        <Image
          src={post.coverImage.src}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          quality={82}
          className="object-cover transition-transform duration-1000 group-hover:scale-105"
        />
      </Link>

      <div className="flex flex-1 flex-col p-5 md:p-6">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[color:var(--brand-forest)]/65">
          {category ? `${category.shortLabel} · ` : ""}
          {formatBlogDate(post.publishedAt)}
        </p>
        <h3
          className="mt-3 text-[1.4rem] font-bold leading-[1.1] tracking-tight text-[color:var(--brand-forest)]"
          style={{ fontFamily: "var(--font-bricolage), var(--font-inter), sans-serif" }}
        >
          <Link href={`/blog/${post.slug}`} className="hover:underline hover:underline-offset-4">
            {post.title}
          </Link>
        </h3>
        <p className="mt-3 line-clamp-3 text-sm leading-7 text-foreground/75">{post.excerpt}</p>
        <Link
          href={`/blog/${post.slug}`}
          className="mt-auto inline-flex items-center gap-2 pt-5 text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--brand-forest)] transition-transform hover:translate-x-1"
        >
          Ler artigo · {post.readingTime} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
