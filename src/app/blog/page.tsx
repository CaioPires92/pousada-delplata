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
    filteredPosts.length === 1 ? "1 conteúdo preparado" : `${filteredPosts.length} conteúdos preparados`;
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
            <p className="max-w-xl text-sm font-medium uppercase tracking-[0.24em] text-primary/50">
              Editorial hospitality
            </p>
            <div className="space-y-4 border-l-2 border-secondary pl-5">
              <h1 className="max-w-4xl text-4xl font-bold font-heading leading-tight text-primary md:text-5xl">
                Conteúdo útil para planejar Serra Negra e avançar com mais segurança para a reserva
              </h1>
              <p className="max-w-3xl text-lg leading-relaxed text-muted-foreground">
                O blog foi estruturado para responder buscas reais sobre Serra Negra, apoiar a decisão
                de hospedagem e conduzir o visitante para a reserva direta sem perder clareza.
              </p>
            </div>
          </div>

          <div className="relative rounded-[28px] border border-primary/10 bg-white p-6 shadow-[0_16px_45px_rgba(40,50,35,0.08)]">
            <div className="absolute left-0 top-6 h-16 w-1 rounded-r-full bg-secondary" aria-hidden="true" />
            <p className="pl-3 text-sm font-semibold uppercase tracking-[0.12em] text-primary/80">
              Blog Delplata
            </p>
            <p className="mt-4 pl-3 text-sm leading-7 text-muted-foreground">
              {selectedCategory
                ? selectedCategory.description
                : "Topo, meio e fundo de funil organizados em uma mesma arquitetura, com seed content explícito e pronta para migração futura para CMS."}
            </p>
            <Link
              href="/reservar"
              className="mt-5 inline-flex pl-3 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
            >
              Ir direto para reserva
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
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/50">
                Biblioteca comercial
              </p>
              <h2 className="text-2xl font-bold font-heading text-primary md:text-3xl">
                {selectedCategory ? selectedCategory.label : "Todos os artigos"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {postCountLabel} para SEO local, usabilidade e conversão.
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
              Esta categoria já está representada pelo conteúdo em destaque. A estrutura está pronta
              para receber novos artigos sem alterar o layout.
            </div>
          )}
        </div>

        <div className="space-y-6 lg:sticky lg:top-28 lg:self-start">
          <BlogCta compact />

          <div className="rounded-[28px] border border-primary/10 bg-white p-6 shadow-[0_16px_45px_rgba(40,50,35,0.08)]">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary/55">
              Governança editorial
            </p>
            <h2 className="mt-2 text-xl font-bold font-heading text-primary">Observação editorial</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Os conteúdos atuais estão marcados como <strong>seed/demo</strong>. A arquitetura está
              pronta para evoluir com CMS, mas os dados locais que exigem precisão ainda devem ser
              validados antes da publicação final.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
