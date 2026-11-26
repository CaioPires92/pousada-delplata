import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BlogBreadcrumbs } from "@/components/blog/BlogBreadcrumbs";
import { BlogPostBody } from "@/components/blog/BlogPostBody";
import { slugifyHeading } from "@/lib/slugify-heading";
import { buildReservarUrl } from "@/constants/specialDates";
import { BlogPostCard } from "@/components/blog/BlogPostCard";
import {
  buildBlogArticleSchema,
  buildBlogPostMetadata,
  buildBreadcrumbSchema,
  formatBlogDate,
  getBlogCategoryBySlug,
  getBlogPostBySlug,
  getBrazilDateKey,
  getRelatedBlogPosts,
} from "@/lib/blog";

type BlogPostPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

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

  const headings = post.content.filter((block) => block.type === "heading" && block.level !== 3);
  const sources = post.content.filter((block) => block.type === "source");
  const cover = post.coverImage;
  const cta = post.bookingCta && (!post.bookingCta.visibleUntil || getBrazilDateKey() <= post.bookingCta.visibleUntil) ? post.bookingCta : null;
  const bookingHref = cta ? buildReservarUrl({ checkIn: cta.checkIn, checkOut: cta.checkOut, adults: 2, children: 0 }) : "/reservar";

  return (
    <main className="min-h-screen bg-[color:var(--brand-cream)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([articleSchema, breadcrumbSchema]),
        }}
      />

      <article>
        <header className="relative flex min-h-[56svh] items-end overflow-hidden bg-[color:var(--brand-forest)]">
          <Image src={cover.src} alt={cover.alt} fill priority sizes="100vw" quality={82} className="object-cover object-center" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,28,18,0.55)_0%,rgba(20,28,18,0.3)_35%,rgba(20,28,18,0.92)_100%)]" />
          <div className="container relative z-10 pb-10 pt-36 text-white md:pb-14">
            <BlogBreadcrumbs
              tone="light"
              items={[
                { label: "Início", href: "/" },
                { label: "Blog", href: "/blog" },
                { label: category.shortLabel, href: `/blog?category=${category.slug}` },
                { label: post.title },
              ]}
            />
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-[#efe3a0]">
              {category.shortLabel} · {formatBlogDate(post.publishedAt)} · {post.readingTime}
            </p>
            <h1
              className="mt-3 max-w-4xl text-[clamp(2rem,5vw,4.2rem)] font-bold leading-[1.02] tracking-tight"
              style={{ fontFamily: "var(--font-bricolage), var(--font-inter), sans-serif" }}
            >
              {post.title}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/88">{post.excerpt}</p>
            {cover.credit ? (
              <p className="mt-6 text-xs text-white/70">
                Foto:{" "}
                {cover.credit.href ? (
                  <a href={cover.credit.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white">
                    {cover.credit.text}
                  </a>
                ) : (
                  cover.credit.text
                )}
              </p>
            ) : null}
          </div>
        </header>

        <div className="container grid gap-12 py-12 md:py-16 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16">
          <div className="min-w-0 max-w-3xl space-y-10">
            <BlogPostBody content={post.content} hideSources />

            <div className="flex flex-wrap gap-2 border-t border-[color:var(--brand-forest)]/15 pt-6">
              {post.tags.map((tag) => (
                <span key={tag} className="border border-[color:var(--brand-forest)]/25 px-3 py-1 text-xs font-semibold text-[color:var(--brand-forest)]">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-[120px] lg:self-start">
            {headings.length >= 2 ? (
              <nav aria-label="Neste artigo" className="border border-[color:var(--brand-forest)]/15 bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--brand-forest)]/70">Neste artigo</p>
                <ul className="mt-3 space-y-2 text-sm">
                  {headings.map((block) =>
                    block.type === "heading" ? (
                      <li key={block.content}>
                        <a href={`#${slugifyHeading(block.content)}`} className="font-medium text-[color:var(--brand-forest)] hover:underline hover:underline-offset-4">
                          {block.content}
                        </a>
                      </li>
                    ) : null,
                  )}
                </ul>
              </nav>
            ) : null}

            {sources.length > 0 ? (
              <section aria-label="Fontes" className="border border-[color:var(--brand-forest)]/15 bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--brand-forest)]/70">Fontes</p>
                <ul className="mt-3 space-y-3 text-sm leading-6">
                  {sources.map((block) =>
                    block.type === "source" ? (
                      <li key={block.href}>
                        <a
                          href={block.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-primary underline decoration-secondary/60 underline-offset-4 hover:text-primary/75"
                        >
                          {block.label}
                        </a>
                      </li>
                    ) : null,
                  )}
                </ul>
              </section>
            ) : null}

            <section className="bg-[color:var(--brand-forest)] p-6 text-white">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--brand-gold)]">Reserva direta</p>
              <p
                className="mt-3 text-2xl font-bold leading-tight tracking-tight"
                style={{ fontFamily: "var(--font-bricolage), var(--font-inter), sans-serif" }}
              >
                Consulte as datas da sua viagem
              </p>
              <p className="mt-2 text-sm leading-6 text-white/80">Veja a disponibilidade e o valor total na hora, direto com a pousada.</p>
              <Link
                href={bookingHref}
                className="mt-5 inline-flex min-h-11 items-center bg-[color:var(--brand-gold)] px-6 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--brand-forest)] transition-opacity hover:opacity-90"
              >
                {cta ? cta.label : "Ver disponibilidade"}
              </Link>
            </section>
          </aside>
        </div>
      </article>

      {relatedPosts.length > 0 ? (
        <section className="border-t border-[color:var(--brand-forest)]/10 bg-white py-12 md:py-16">
          <div className="container">
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--brand-forest)]/70">Continue navegando</p>
                <h2
                  className="mt-2 text-[clamp(1.7rem,3vw,2.4rem)] font-bold leading-tight tracking-tight text-[color:var(--brand-forest)]"
                  style={{ fontFamily: "var(--font-bricolage), var(--font-inter), sans-serif" }}
                >
                  Conteúdos relacionados
                </h2>
              </div>
              <Link href="/blog" className="text-sm font-bold text-[color:var(--brand-forest)] underline underline-offset-4">
                Ver todos os artigos
              </Link>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
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
