-- CreateTable
CREATE TABLE "Recording" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "channelId" TEXT,
    "messageId" TEXT,
    "creatorId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Untitled recording',
    "attachmentId" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "durationSec" INTEGER,
    "shareSlug" TEXT NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recording_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Recording_attachmentId_key" ON "Recording"("attachmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Recording_shareSlug_key" ON "Recording"("shareSlug");

-- CreateIndex
CREATE INDEX "Recording_workspaceId_isDeleted_idx" ON "Recording"("workspaceId", "isDeleted");

-- CreateIndex
CREATE INDEX "Recording_channelId_idx" ON "Recording"("channelId");

-- CreateIndex
CREATE INDEX "Recording_messageId_idx" ON "Recording"("messageId");

-- CreateIndex
CREATE INDEX "Recording_shareSlug_idx" ON "Recording"("shareSlug");

-- CreateIndex
CREATE INDEX "Recording_creatorId_idx" ON "Recording"("creatorId");

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
