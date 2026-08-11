import prisma from "@/lib/prisma";

export function normalizeOfficialReviewUrl(value: unknown): string | null | undefined {
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 2_000) return undefined;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" || url.username || url.password) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export async function getPostStaySettings() {
  const settings = await prisma.postStaySettings.findUnique({ where: { id: "global" } });
  return {
    officialReviewUrl: settings?.officialReviewUrl ?? null,
    reviewConfigured: Boolean(settings?.officialReviewUrl),
  };
}
