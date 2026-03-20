import type { Metadata } from "next";

import { blogCategories, blogPosts } from "@/data/blog-posts";
import { BlogCategory, BlogPost } from "@/types/blog";

const FALLBACK_SITE_URL = "http://localhost:3001";

export function getSiteUrl() {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined) ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
    FALLBACK_SITE_URL;

  return envUrl.replace(/\/$/, "");
}

export function absoluteUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteUrl()}${normalizedPath}`;
}

export function formatBlogDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

export function getAllBlogCategories() {
  return blogCategories;
}

export function getBlogCategoryBySlug(slug?: string | null) {
  if (!slug) return undefined;

  return blogCategories.find((category) => category.slug === slug);
}

export function getAllBlogPosts() {
  return [...blogPosts].sort((left, right) =>
    right.publishedAt.localeCompare(left.publishedAt),
  );
}

export function getBlogPostBySlug(slug: string) {
  return blogPosts.find((post) => post.slug === slug);
}

export function getBlogPostsByCategory(category?: string | null) {
  if (!category || !getBlogCategoryBySlug(category)) {
    return getAllBlogPosts();
  }

  return getAllBlogPosts().filter((post) => post.category === category);
}

export function getFeaturedBlogPost(posts: BlogPost[]) {
  return posts.find((post) => post.featured) ?? posts[0];
}

export function getRelatedBlogPosts(post: BlogPost, limit = 3) {
  const sameCategory = getAllBlogPosts().filter(
    (candidate) => candidate.slug !== post.slug && candidate.category === post.category,
  );

  const fromTags = getAllBlogPosts().filter(
    (candidate) =>
      candidate.slug !== post.slug &&
      candidate.category !== post.category &&
      candidate.tags.some((tag) => post.tags.includes(tag)),
  );

  return [...sameCategory, ...fromTags].slice(0, limit);
}

export function getCategoryPostCount(category: BlogCategory) {
  return blogPosts.filter((post) => post.category === category.slug).length;
}

function buildBaseOpenGraph({
  title,
  description,
  path,
  image,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
}) {
  return {
    title,
    description,
    url: absoluteUrl(path),
    siteName: "Pousada Delplata",
    locale: "pt_BR",
    type: "article" as const,
    images: image
      ? [
          {
            url: absoluteUrl(image),
            alt: title,
          },
        ]
      : undefined,
  };
}

export function buildBlogIndexMetadata(category?: BlogCategory) {
  const title = category
    ? `${category.shortLabel} em Serra Negra | Blog Delplata`
    : "Blog da Pousada Delplata | Serra Negra";
  const description = category
    ? `${category.description} Veja orientações claras para planejar melhor a estadia em Serra Negra.`
    : "Guias, comparativos e conteúdos úteis para planejar a viagem, escolher a hospedagem e aproveitar melhor Serra Negra.";
  const canonicalPath = category ? `/blog?category=${category.slug}` : "/blog";

  return {
    title,
    description,
    alternates: {
      canonical: absoluteUrl(canonicalPath),
    },
    openGraph: buildBaseOpenGraph({
      title,
      description,
      path: canonicalPath,
      image: "/fotos/piscina-aptos/DJI_0845.jpg",
    }),
    twitter: {
      card: "summary_large_image" as const,
      title,
      description,
      images: [absoluteUrl("/fotos/piscina-aptos/DJI_0845.jpg")],
    },
  } satisfies Metadata;
}

export function buildBlogPostMetadata(post: BlogPost) {
  return {
    title: post.seo.title,
    description: post.seo.description,
    alternates: {
      canonical: absoluteUrl(`/blog/${post.slug}`),
    },
    openGraph: buildBaseOpenGraph({
      title: post.seo.title,
      description: post.seo.description,
      path: `/blog/${post.slug}`,
      image: post.coverImage.src,
    }),
    twitter: {
      card: "summary_large_image" as const,
      title: post.seo.title,
      description: post.seo.description,
      images: [absoluteUrl(post.coverImage.src)],
    },
  } satisfies Metadata;
}

export function buildBreadcrumbSchema(
  items: Array<{ name: string; path: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function buildBlogListSchema(posts: BlogPost[]) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Blog da Pousada Delplata",
    url: absoluteUrl("/blog"),
    about: {
      "@type": "Place",
      name: "Serra Negra, SP",
    },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: posts.map((post, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(`/blog/${post.slug}`),
        name: post.title,
      })),
    },
  };
}

export function buildBlogArticleSchema(post: BlogPost, category: BlogCategory) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.seo.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    articleSection: category.label,
    keywords: post.tags.join(", "),
    inLanguage: "pt-BR",
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
    image: absoluteUrl(post.coverImage.src),
    author: {
      "@type": "Organization",
      name: "Pousada Delplata",
    },
    publisher: {
      "@type": "Organization",
      name: "Pousada Delplata",
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/fotos/logo.png"),
      },
    },
    about: [
      {
        "@type": "Place",
        name: "Serra Negra, SP",
      },
      {
        "@type": "LodgingBusiness",
        name: "Pousada Delplata",
      },
    ],
  };
}
