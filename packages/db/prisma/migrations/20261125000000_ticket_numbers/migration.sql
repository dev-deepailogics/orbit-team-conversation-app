-- New tickets are numbered 1, 2, 3… per project. The project keeps the last number it issued.
-- Existing tickets are left exactly as they are; numbering continues after any number a ticket already has (imported
-- ones), so a new ticket never repeats one.
ALTER TABLE "Project" ADD COLUMN "ticketCounter" INTEGER NOT NULL DEFAULT 0;

UPDATE "Project" p
SET "ticketCounter" = COALESCE((SELECT MAX(t."issueNumber") FROM "Ticket" t WHERE t."projectId" = p.id), 0);
