import type { Metadata } from "next";
import Link from "next/link";

import { BlogCategoryFilter } from "@/components/blog/BlogCategoryFilter";
import { BlogCta } from "@/components/blog/BlogCta";
import { BlogFeaturedPost } from "@/components/blog/BlogFeaturedPost";
import { BlogPostCard } from "@/components/blog/BlogPostCard";
import {
  buildBlogIndexMetadata,
  buildBlogListSchema,
  buildBreadcrumbSchema,
  getAllBlogCategories,
  getBlogCategoryBySlug,
  getBlogPostsByCategory,
  getFeaturedBlogPost,
} from "@/lib/blog";

type BlogPageProps = {
  searchParams: Promise<{
    category?: string;
  }>;
};

export async function generateMetadata({
  searchParams,
}: BlogPageProps): Promise<Metadata> {
  const { category } = await searchParams;
  const selectedCategory = getBlogCategoryBySlug(category);

  return buildBlogIndexMetadata(selectedCategory);
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const { category } = await searchParams;
  const selectedCategory = getBlogCategoryBySlug(category);
  const categories = getAllBlogCategories();
  const filteredPosts = getBlogPostsByCategory(category);
  const featuredPost = getFeaturedBlogPost(filteredPosts);
  const remainingPosts = filteredPosts.filter((post) => post.slug !== featuredPost?.slug);
  const postCountLabel =
    filteredPosts.length === 1 ? "1 artigo" : `${filteredPosts.length} artigos`;
  const listSchema = buildBlogListSchema(filteredPosts);
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: "Início", path: "/" },
    { name: "Blog", path: "/blog" },
  ]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-stone-50 pb-20 pt-32">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        aria-hidden="true"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(40,50,35,0.24) 1px, transparent 1px), linear-gradient(to bottom, rgba(40,50,35,0.18) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle at top left, rgba(187,184,99,0.18), transparent 42%), linear-gradient(180deg, rgba(255,255,255,0.82), rgba(245,245,244,0))",
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([breadcrumbSchema, listSchema]),
        }}
      />

      <section className="container relative">
        <div className="grid gap-8 pb-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <span className="h-px w-14 bg-secondary" aria-hidden="true" />
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-secondary-foreground/80">
                Blog Delplata
              </p>
            </div>
            <div className="space-y-4 border-l-2 border-secondary pl-5">
              <h1 className="max-w-4xl text-4xl font-bold font-heading leading-tight text-primary md:text-5xl">
                Conteúdo útil para planejar sua viagem para Serra Negra com mais segurança
              </h1>
              <p className="max-w-3xl text-lg leading-relaxed text-muted-foreground">
                Descubra o que fazer, onde ficar e como aproveitar melhor a estadia em Serra Negra.
              </p>
            </div>
          </div>

          <div className="relative rounded-[28px] border border-primary/10 bg-white p-6 shadow-[0_16px_45px_rgba(40,50,35,0.08)]">
            <div className="absolute left-0 top-6 h-16 w-1 rounded-r-full bg-secondary" aria-hidden="true" />
            <p className="pl-3 text-sm font-semibold uppercase tracking-[0.12em] text-primary/80">
              Planeje melhor a viagem
            </p>
            <p className="mt-4 pl-3 text-sm leading-7 text-muted-foreground">
              {selectedCategory
                ? selectedCategory.description
                : "Guias práticos para montar o roteiro, escolher a hospedagem e chegar com mais clareza à viagem."}
            </p>
            <Link
              href="/reservar"
              className="mt-5 inline-flex pl-3 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
            >
              Consultar datas
            </Link>
          </div>
        </div>

        <div className="space-y-8">
          <BlogCategoryFilter categories={categories} activeCategory={selectedCategory?.slug} />

          {featuredPost ? <BlogFeaturedPost post={featuredPost} /> : null}
        </div>
      </section>

      <section className="container mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold font-heading text-primary md:text-3xl">
                {selectedCategory ? selectedCategory.label : "Todos os artigos"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {postCountLabel} sobre roteiro, hospedagem e planejamento da viagem.
              </p>
            </div>
          </div>

          {remainingPosts.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2">
              {remainingPosts.map((post) => (
                <BlogPostCard key={post.slug} post={post} />
              ))}
            </div>
          ) : (
            <div className="rounded-[28px] border border-dashed border-primary/20 bg-white p-6 text-sm leading-7 text-muted-foreground">
              No momento, esta seleção reúne apenas o artigo em destaque.
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-28 lg:self-start">
          <BlogCta compact />
        </div>
      </section>
    </main>
  );
}
