import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatBlogDate, getBlogCategoryBySlug } from "@/lib/blog";
import { BlogPost } from "@/types/blog";

interface BlogFeaturedPostProps {
  post: BlogPost;
}

export function BlogFeaturedPost({ post }: BlogFeaturedPostProps) {
  const category = getBlogCategoryBySlug(post.category);

  return (
    <article className="overflow-hidden border border-primary/10 bg-[color:var(--brand-white)]">
      <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
        <Link href={`/blog/${post.slug}`} className="relative min-h-[320px] bg-primary/5">
          <Image
            src={post.coverImage.src}
            alt={post.coverImage.alt}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 55vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/60 via-primary/10 to-transparent" />
          <div className="absolute left-5 top-5 border border-white/20 bg-black/15 px-4 py-3 text-white backdrop-blur-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">
              Caderno de Serra Negra
            </p>
            <p className="mt-1 text-sm font-medium">Ideias práticas para organizar a viagem</p>
          </div>
        </Link>

        <div className="flex flex-col justify-between p-6 md:p-8">
          <div className="space-y-4">
            <div className="space-y-4 border-l-2 border-secondary pl-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="secondary" className="rounded-none px-3 py-1">
                  Destaque
                </Badge>
                {category ? (
                  <Badge variant="outline" className="rounded-none px-3 py-1">
                    {category.shortLabel}
                  </Badge>
                ) : null}
              </div>

              <div className="space-y-3">
                <p className="text-sm text-foreground/72">
                  {formatBlogDate(post.publishedAt)} • {post.readingTime}
                </p>
                <h2 className="font-heading text-[2.2rem] font-semibold leading-tight text-primary md:text-[3rem]">
                  <Link href={`/blog/${post.slug}`} className="hover:text-primary/85">
                    {post.title}
                  </Link>
                </h2>
                <p className="text-base leading-8 text-foreground/72">{post.excerpt}</p>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <div className="bg-[color:var(--brand-cream)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/60">
                Resumo rápido
              </p>
              <p className="mt-2 max-w-md text-sm leading-7 text-foreground/72">{post.summary}</p>
            </div>
            <Link
              href={`/blog/${post.slug}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition-transform hover:translate-x-1"
            >
              Ler artigo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
