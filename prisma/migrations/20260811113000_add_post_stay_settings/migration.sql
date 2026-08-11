CREATE TABLE "PostStaySettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'global',
    "officialReviewUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
