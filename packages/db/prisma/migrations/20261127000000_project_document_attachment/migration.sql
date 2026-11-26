-- A project doc can be an uploaded file (PDF / Word) instead of typed text: it points at the uploaded Attachment.
ALTER TABLE "ProjectDocument" ADD COLUMN "attachmentId" TEXT,
ALTER COLUMN "content" SET DEFAULT '';

CREATE INDEX "ProjectDocument_attachmentId_idx" ON "ProjectDocument"("attachmentId");

ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
