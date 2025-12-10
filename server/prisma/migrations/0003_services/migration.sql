-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "folder" TEXT,
    "params" JSONB NOT NULL DEFAULT '[]',
    "headers" JSONB NOT NULL DEFAULT '[]',
    "body" TEXT,
    "authType" TEXT,
    "bearer" TEXT,
    "responses" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceRequest_name_idx" ON "ServiceRequest"("name");

-- CreateIndex
CREATE INDEX "ServiceRequest_folder_idx" ON "ServiceRequest"("folder");
