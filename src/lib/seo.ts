import type { Metadata } from "next";

const FALLBACK_SITE_URL = "http://localhost:3001";

export const DEFAULT_OG_IMAGE = "/fotos/piscina-aptos/DJI_0845.jpg";

const BUSINESS_NAME = "Pousada Delplata";
const BUSINESS_DESCRIPTION =
  "Pousada em Serra Negra com acomodações para famílias, piscina, café da manhã e reserva online no site oficial.";

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
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteUrl()}${normalizedPath}`;
}

export function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

type BuildPageMetadataInput = {
  title: string;
  description: string;
  path: string;
  image?: string;
  keywords?: string[];
  type?: "website" | "article";
  noIndex?: boolean;
};

export function buildPageMetadata({
  title,
  description,
  path,
  image = DEFAULT_OG_IMAGE,
  keywords,
  type = "website",
  noIndex = false,
}: BuildPageMetadataInput): Metadata {
  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: absoluteUrl(path),
    },
    openGraph: {
      title,
      description,
      url: absoluteUrl(path),
      siteName: BUSINESS_NAME,
      locale: "pt_BR",
      type,
      images: [
        {
          url: absoluteUrl(image),
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [absoluteUrl(image)],
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
        }
      : undefined,
  };
}

export function buildBreadcrumbSchema(items: Array<{ name: string; path: string }>) {
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

export function buildWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BUSINESS_NAME,
    description: BUSINESS_DESCRIPTION,
    url: absoluteUrl("/"),
    inLanguage: "pt-BR",
  };
}

export function buildLodgingBusinessSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: BUSINESS_NAME,
    description: BUSINESS_DESCRIPTION,
    url: absoluteUrl("/"),
    image: absoluteUrl(DEFAULT_OG_IMAGE),
    telephone: "+55 19 3842-2559",
    email: "contato@pousadadelplata.com.br",
    address: {
      "@type": "PostalAddress",
      streetAddress: "R. Vicente Frederico Leporas, 151",
      addressLocality: "Serra Negra",
      addressRegion: "SP",
      postalCode: "13930-000",
      addressCountry: "BR",
    },
    amenityFeature: [
      {
        "@type": "LocationFeatureSpecification",
        name: "Piscina",
        value: true,
      },
      {
        "@type": "LocationFeatureSpecification",
        name: "Café da manhã",
        value: true,
      },
      {
        "@type": "LocationFeatureSpecification",
        name: "Reserva online",
        value: true,
      },
    ],
  };
}
