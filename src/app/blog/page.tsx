import type { Metadata } from "next";

import PageHero from "@/components/home-novo/PageHero";
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

export const dynamic = "force-dynamic";

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
    <main className="relative min-h-screen overflow-hidden bg-[color:var(--brand-cream)] pb-20">
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

      <PageHero
        eyebrow="Blog Delplata"
        title={<>Planeje sua <em>viagem</em></>}
        text="Roteiros, hospedagem, datas e eventos em Serra Negra, em uma leitura direta e sem excesso de informação."
      />

      <section className="container relative mt-10">
        <div className="space-y-8">
          <BlogCategoryFilter categories={categories} activeCategory={selectedCategory?.slug} />

          {featuredPost ? <BlogFeaturedPost post={featuredPost} /> : null}
        </div>
      </section>

      <section className="container mt-10">
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-heading text-[2rem] font-semibold leading-tight text-primary md:text-[2.6rem]">
                {selectedCategory ? selectedCategory.label : "Todos os artigos"}
              </h2>
              <p className="mt-2 text-sm text-foreground/72">
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
            <div className="border border-dashed border-primary/20 bg-[color:var(--brand-white)] p-6 text-sm leading-7 text-foreground/72">
              No momento, esta seleção reúne apenas o artigo em destaque.
            </div>
          )}
        </div>
      </section>

      <section className="container mt-10">
        <BlogCta compact />
      </section>
    </main>
  );
}
