import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BlogBreadcrumbs } from "@/components/blog/BlogBreadcrumbs";
import { BlogCta } from "@/components/blog/BlogCta";
import { BlogPostBody } from "@/components/blog/BlogPostBody";
import { BlogPostCard } from "@/components/blog/BlogPostCard";
import { Badge } from "@/components/ui/badge";
import {
  buildBlogArticleSchema,
  buildBlogPostMetadata,
  buildBreadcrumbSchema,
  formatBlogDate,
  getAllBlogPosts,
  getBlogCategoryBySlug,
  getBlogPostBySlug,
  getRelatedBlogPosts,
} from "@/lib/blog";

type BlogPostPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllBlogPosts().map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    return {
      title: "Conteúdo não encontrado | Blog Delplata",
    };
  }

  return buildBlogPostMetadata(post);
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const category = getBlogCategoryBySlug(post.category);

  if (!category) {
    notFound();
  }

  const relatedPosts = getRelatedBlogPosts(post);
  const articleSchema = buildBlogArticleSchema(post, category);
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: "Início", path: "/" },
    { name: "Blog", path: "/blog" },
    { name: category.shortLabel, path: `/blog?category=${category.slug}` },
    { name: post.title, path: `/blog/${post.slug}` },
  ]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-stone-50 pb-20 pt-32">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.045]"
        aria-hidden="true"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(40,50,35,0.24) 1px, transparent 1px), linear-gradient(to bottom, rgba(40,50,35,0.18) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[380px]"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle at top left, rgba(187,184,99,0.16), transparent 40%), linear-gradient(180deg, rgba(255,255,255,0.82), rgba(245,245,244,0))",
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([articleSchema, breadcrumbSchema]),
        }}
      />

      <article className="container relative">
        <div className="mx-auto max-w-5xl">
          <BlogBreadcrumbs
            items={[
              { label: "Início", href: "/" },
              { label: "Blog", href: "/blog" },
              { label: category.shortLabel, href: `/blog?category=${category.slug}` },
              { label: post.title },
            ]}
          />

          <header className="mt-6 space-y-6">
            <div className="flex items-center gap-4">
              <span className="h-px w-14 bg-secondary" aria-hidden="true" />
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/55">
                Guia editorial Delplata
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                {category.shortLabel}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {formatBlogDate(post.publishedAt)}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {post.readingTime}
              </Badge>
              {post.seedDemo ? (
                <Badge variant="outline" className="rounded-full px-3 py-1 text-muted-foreground">
                  Seed/demo
                </Badge>
              ) : null}
            </div>

            <div className="space-y-4">
              <h1 className="max-w-4xl border-l-2 border-secondary pl-5 text-4xl font-bold font-heading leading-tight text-primary md:text-5xl">
                {post.title}
              </h1>
              <p className="max-w-3xl text-lg leading-relaxed text-muted-foreground">
                {post.excerpt}
              </p>
            </div>
          </header>

          <div className="mt-8 overflow-hidden rounded-[32px] border border-primary/10 bg-white shadow-[0_18px_50px_rgba(40,50,35,0.08)]">
            <div className="relative aspect-[16/8] bg-primary/5">
              <Image
                src={post.coverImage.src}
                alt={post.coverImage.alt}
                fill
                priority
                sizes="(max-width: 1280px) 100vw, 1100px"
                className="object-cover"
              />
            </div>

            <div className="grid gap-10 px-6 py-8 md:px-10 md:py-10 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-10">
                <BlogPostBody content={post.content} />

                <div className="flex flex-wrap gap-2 border-t border-primary/10 pt-6">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-primary/5 px-3 py-1 text-xs font-medium text-primary"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
                <div className="rounded-[28px] border border-primary/10 bg-stone-50 p-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary/80">
                    Resumo do artigo
                  </p>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{post.summary}</p>
                </div>

                <div className="rounded-[28px] border border-primary/10 bg-white p-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary/55">
                    Foco do conteúdo
                  </p>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    Este artigo foi desenhado para responder uma etapa específica da decisão de
                    viagem, sem competir com o objetivo principal do site: a reserva direta.
                  </p>
                </div>

                <BlogCta compact />
              </aside>
            </div>
          </div>
        </div>
      </article>

      {relatedPosts.length > 0 ? (
        <section className="container mt-14">
          <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/80">
                  Continue navegando
                </p>
                <h2 className="mt-2 text-3xl font-bold font-heading text-primary">
                  Conteúdos relacionados
                </h2>
              </div>
              <Link href="/blog" className="text-sm font-semibold text-primary hover:text-primary/80">
                Ver todos os artigos
              </Link>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {relatedPosts.map((relatedPost) => (
                <BlogPostCard key={relatedPost.slug} post={relatedPost} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
