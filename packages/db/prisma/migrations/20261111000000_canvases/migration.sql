-- CreateTable
CREATE TABLE "Canvas" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Untitled canvas',
    "data" JSONB,
    "channelId" TEXT,
    "projectId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Canvas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Canvas_workspaceId_idx" ON "Canvas"("workspaceId");
CREATE INDEX "Canvas_channelId_idx" ON "Canvas"("channelId");
CREATE INDEX "Canvas_projectId_idx" ON "Canvas"("projectId");

-- AddForeignKey
ALTER TABLE "Canvas" ADD CONSTRAINT "Canvas_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Canvas" ADD CONSTRAINT "Canvas_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Canvas" ADD CONSTRAINT "Canvas_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Canvas" ADD CONSTRAINT "Canvas_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry over existing per-channel whiteboards as canvases linked to their channel.
-- Falls back to the workspace owner when the channel creator no longer exists.
INSERT INTO "Canvas" ("id", "workspaceId", "title", "data", "channelId", "createdById", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, c."workspaceId", c."name" || ' canvas', c."whiteboardData", c."id",
       COALESCE(u."id", w."ownerId"), c."updatedAt", CURRENT_TIMESTAMP
FROM "Channel" c
JOIN "Workspace" w ON w."id" = c."workspaceId"
LEFT JOIN "User" u ON u."id" = c."createdById"
WHERE CASE WHEN jsonb_typeof(c."whiteboardData"->'elements') = 'array'
           THEN jsonb_array_length(c."whiteboardData"->'elements') ELSE 0 END > 0;
