-- Docs become workspace-level: project link is optional and survives project deletion.
ALTER TABLE "ProjectDocument" ALTER COLUMN "projectId" DROP NOT NULL;

ALTER TABLE "ProjectDocument" DROP CONSTRAINT "ProjectDocument_projectId_fkey";
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
