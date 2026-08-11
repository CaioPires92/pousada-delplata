import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ default: { postStaySettings: { findUnique: vi.fn() } } }));

import prisma from "@/lib/prisma";
import { getPostStaySettings, normalizeOfficialReviewUrl } from "./postStaySettings";

describe("post-stay settings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts only HTTPS URLs without embedded credentials", () => {
    expect(normalizeOfficialReviewUrl("https://example.com/review")).toBe("https://example.com/review");
    expect(normalizeOfficialReviewUrl("http://example.com/review")).toBeUndefined();
    expect(normalizeOfficialReviewUrl("https://user:secret@example.com/review")).toBeUndefined();
    expect(normalizeOfficialReviewUrl("not-a-url")).toBeUndefined();
  });

  it("is safely unconfigured by default", async () => {
    vi.mocked(prisma.postStaySettings.findUnique).mockResolvedValue(null);
    await expect(getPostStaySettings()).resolves.toEqual({
      officialReviewUrl: null,
      reviewConfigured: false,
    });
  });
});
