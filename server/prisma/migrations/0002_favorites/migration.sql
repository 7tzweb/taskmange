-- Create favorites table
CREATE TABLE IF NOT EXISTS "Favorite" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT,
  "link" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Favorite_title_idx" ON "Favorite" ("title");
