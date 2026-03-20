export type BlogCategorySlug =
  | "o-que-fazer"
  | "onde-ficar"
  | "dicas-de-viagem"
  | "delplata"
  | "guias-sazonais";

export type BlogFunnelStage = "topo" | "meio" | "fundo";

export type BlogContentBlock =
  | {
      type: "paragraph";
      content: string;
    }
  | {
      type: "heading";
      content: string;
      level?: 2 | 3;
    }
  | {
      type: "list";
      items: string[];
      ordered?: boolean;
    }
  | {
      type: "callout";
      title?: string;
      content: string;
    };

export interface BlogCategory {
  slug: BlogCategorySlug;
  label: string;
  shortLabel: string;
  description: string;
}

export interface BlogCoverImage {
  src: string;
  alt: string;
}

export interface BlogPostSeo {
  title: string;
  description: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  summary: string;
  publishedAt: string;
  updatedAt?: string;
  readingTime: string;
  category: BlogCategorySlug;
  tags: string[];
  coverImage: BlogCoverImage;
  seo: BlogPostSeo;
  featured?: boolean;
  seedDemo: boolean;
  funnelStage: BlogFunnelStage;
  content: BlogContentBlock[];
}
