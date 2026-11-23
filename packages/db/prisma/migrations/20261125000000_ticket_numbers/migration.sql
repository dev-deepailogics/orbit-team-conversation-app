-- Tickets are numbered 1, 2, 3… per project. The project keeps the last number it issued.
ALTER TABLE "Project" ADD COLUMN "ticketCounter" INTEGER NOT NULL DEFAULT 0;

-- Number existing tickets that have none, oldest first, after any number a ticket already has (imported ones)
WITH numbered AS (
  SELECT t.id,
         COALESCE((SELECT MAX(x."issueNumber") FROM "Ticket" x WHERE x."projectId" = t."projectId"), 0)
           + ROW_NUMBER() OVER (PARTITION BY t."projectId" ORDER BY t."createdAt", t.id) AS n
  FROM "Ticket" t
  WHERE t."issueNumber" IS NULL
)
UPDATE "Ticket" t SET "issueNumber" = numbered.n FROM numbered WHERE t.id = numbered.id;

UPDATE "Project" p
SET "ticketCounter" = COALESCE((SELECT MAX(t."issueNumber") FROM "Ticket" t WHERE t."projectId" = p.id), 0);
