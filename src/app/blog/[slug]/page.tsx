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
    <main className="relative min-h-screen overflow-hidden bg-[color:var(--brand-cream)] pb-20 pt-32">
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
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary" className="rounded-none px-3 py-1">
                {category.shortLabel}
              </Badge>
              <Badge variant="outline" className="rounded-none px-3 py-1">
                {formatBlogDate(post.publishedAt)}
              </Badge>
              <Badge variant="outline" className="rounded-none px-3 py-1">
                {post.readingTime}
              </Badge>
            </div>

            <div className="space-y-4">
              <h1 className="max-w-4xl border-l-2 border-secondary pl-5 font-heading text-[2.9rem] font-semibold leading-[0.98] text-primary md:text-[4rem]">
                {post.title}
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-foreground/72">
                {post.excerpt}
              </p>
            </div>
          </header>

          <div className="mt-8 overflow-hidden border border-primary/10 bg-[color:var(--brand-white)]">
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

            <div className="px-6 py-8 md:px-10 md:py-10">
              <div className="mx-auto max-w-3xl space-y-10">
                <BlogPostBody content={post.content} />

                <div className="flex flex-wrap gap-2 border-t border-primary/10 pt-6">
                  {post.tags.map((tag) => (
                    <span key={tag} className="bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                      {tag}
                    </span>
                  ))}
                </div>

                <BlogCta compact />
              </div>
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
                <h2 className="mt-2 font-heading text-[2.2rem] font-semibold leading-tight text-primary">
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
