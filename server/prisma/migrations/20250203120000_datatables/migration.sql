-- CreateTable
CREATE TABLE "DataTable" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "columns" JSONB NOT NULL DEFAULT '[]',
    "rows" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataTable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataTable_name_idx" ON "DataTable"("name");
