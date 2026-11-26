import type { Metadata } from "next";

import homeStyles from "@/components/home-novo/home-novo.module.css";
import PageHero from "@/components/home-novo/PageHero";
import { BlogAgenda } from "@/components/blog/BlogAgenda";
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
    <main className="min-h-screen bg-[color:var(--brand-cream)]">
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

      <section className="container mt-8 space-y-6">
        <BlogCategoryFilter categories={categories} activeCategory={selectedCategory?.slug} />
        {featuredPost ? <BlogFeaturedPost post={featuredPost} /> : null}
      </section>

      <div className="mt-12">
        <BlogAgenda />
      </div>

      <section className="container py-12 md:py-16">
        <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <h2 className={`${homeStyles.display} ${homeStyles.displayDark} text-[clamp(1.9rem,4vw,3.2rem)] text-[color:var(--brand-forest)]`}>
            {selectedCategory ? selectedCategory.label : <>Todos os <em>artigos</em></>}
          </h2>
          <p className="text-sm text-[color:var(--brand-forest)]/70">
            {postCountLabel} sobre roteiro, hospedagem e planejamento da viagem.
          </p>
        </div>

        {remainingPosts.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {remainingPosts.map((post) => (
              <BlogPostCard key={post.slug} post={post} />
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-[color:var(--brand-forest)]/25 bg-white p-6 text-sm leading-7 text-foreground/72">
            No momento, esta seleção reúne apenas o artigo em destaque.
          </div>
        )}
      </section>

      <section className="container pb-16">
        <BlogCta compact />
      </section>
    </main>
  );
}
