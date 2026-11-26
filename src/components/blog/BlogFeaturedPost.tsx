import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { formatBlogDate, getBlogCategoryBySlug } from "@/lib/blog";
import { BlogPost } from "@/types/blog";

interface BlogFeaturedPostProps {
  post: BlogPost;
}

export function BlogFeaturedPost({ post }: BlogFeaturedPostProps) {
  const category = getBlogCategoryBySlug(post.category);

  return (
    <article className="group relative min-h-[420px] overflow-hidden bg-[color:var(--brand-forest)] md:min-h-[520px]">
      <Link href={`/blog/${post.slug}`} aria-label={post.title} className="absolute inset-0 z-10" />
      <Image
        src={post.coverImage.src}
        alt={post.coverImage.alt}
        fill
        priority
        sizes="100vw"
        quality={82}
        className="object-cover transition-transform duration-1000 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,28,18,0.1)_20%,rgba(20,28,18,0.92)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 p-6 text-white md:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#efe3a0]">
          Destaque{category ? ` · ${category.shortLabel}` : ""}
        </p>
        <h2
          className="mt-3 max-w-3xl text-[clamp(1.8rem,3.8vw,3.2rem)] font-bold leading-[1.05] tracking-tight"
          style={{ fontFamily: "var(--font-bricolage), var(--font-inter), sans-serif" }}
        >
          {post.title}
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-white/85">{post.excerpt}</p>
        <p className="mt-5 flex items-center gap-4 text-sm text-white/75">
          <span>
            {formatBlogDate(post.publishedAt)} · {post.readingTime}
          </span>
          <span className="inline-flex items-center gap-2 font-bold uppercase tracking-[0.14em] text-[color:var(--brand-gold)]">
            Ler artigo <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </span>
        </p>
      </div>
    </article>
  );
}
