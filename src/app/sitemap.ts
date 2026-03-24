import type { MetadataRoute } from "next";

import { getAllBlogPosts } from "@/lib/blog";
import prisma from "@/lib/prisma";
import { absoluteUrl } from "@/lib/seo";

const staticRoutes = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/acomodacoes", changeFrequency: "weekly", priority: 0.9 },
  { path: "/reservar", changeFrequency: "daily", priority: 0.9 },
  { path: "/lazer", changeFrequency: "monthly", priority: 0.7 },
  { path: "/restaurante", changeFrequency: "monthly", priority: 0.7 },
  { path: "/contato", changeFrequency: "monthly", priority: 0.7 },
  { path: "/blog", changeFrequency: "weekly", priority: 0.8 },
  { path: "/politica-de-cancelamento", changeFrequency: "yearly", priority: 0.3 },
  { path: "/politica-de-privacidade", changeFrequency: "yearly", priority: 0.3 },
  { path: "/termos-e-condicoes", changeFrequency: "yearly", priority: 0.3 },
] as const satisfies Array<{
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
}>;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const blogEntries: MetadataRoute.Sitemap = getAllBlogPosts().map((post) => ({
    url: absoluteUrl(`/blog/${post.slug}`),
    lastModified: new Date(post.updatedAt ?? post.publishedAt),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  let roomEntries: MetadataRoute.Sitemap = [];

  try {
    const rooms = await prisma.roomType.findMany({
      select: {
        id: true,
        updatedAt: true,
      },
    });

    roomEntries = rooms.map((room) => ({
      url: absoluteUrl(`/acomodacoes/${room.id}`),
      lastModified: room.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    }));
  } catch {
    roomEntries = [];
  }

  return [...staticEntries, ...blogEntries, ...roomEntries];
}
