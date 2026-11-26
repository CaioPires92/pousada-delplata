export type BlogCategorySlug =
  | "o-que-fazer"
  | "onde-ficar"
  | "dicas-de-viagem"
  | "delplata"
  | "guias-sazonais";

export type BlogFunnelStage = "topo" | "meio" | "fundo";

type BlogContentVisibility = {
  visibleUntil?: string;
};

/** Crédito de uma foto de terceiros: quem fez/publicou e, se houver, o link da origem. */
export interface BlogImageCredit {
  text: string;
  href?: string;
}

export type BlogContentBlock = BlogContentVisibility & (
  | {
      type: "paragraph";
      content: string;
    }
  | {
      type: "image";
      src: string;
      alt: string;
      caption?: string;
      credit?: BlogImageCredit;
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
    }
  | {
      /** Botão de reserva com datas já preenchidas (use `visibleUntil` para sumir depois do evento). */
      type: "cta";
      label: string;
      checkIn: string;
      checkOut: string;
      note?: string;
    }
  | {
      type: "source";
      label: string;
      href: string;
    }
);

export interface BlogCategory {
  slug: BlogCategorySlug;
  label: string;
  shortLabel: string;
  description: string;
}

export interface BlogCoverImage {
  src: string;
  alt: string;
  credit?: BlogImageCredit;
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
  expiresAt?: string;
  readingTime: string;
  category: BlogCategorySlug;
  tags: string[];
  coverImage: BlogCoverImage;
  seo: BlogPostSeo;
  featured?: boolean;
  /** Datas da reserva sugerida na lateral do artigo (some depois de `visibleUntil`). */
  bookingCta?: { label: string; checkIn: string; checkOut: string; visibleUntil?: string };
  seedDemo: boolean;
  funnelStage: BlogFunnelStage;
  content: BlogContentBlock[];
}
