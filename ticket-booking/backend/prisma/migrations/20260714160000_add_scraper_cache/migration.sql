-- Create ScraperCache table
CREATE TABLE "ScraperCache" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScraperCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScraperCache_city_type_key" ON "ScraperCache"("city", "type");
CREATE INDEX "ScraperCache_expiresAt_idx" ON "ScraperCache"("expiresAt");
