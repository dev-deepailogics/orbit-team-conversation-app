-- Workspace admin is now per workspace (WorkspaceMember.role = ADMIN). Former global WORKSPACE_ADMINs become USER
-- and keep whatever OWNER/ADMIN roles they already hold in their workspaces.
UPDATE "User" SET "systemRole" = 'USER' WHERE "systemRole" = 'WORKSPACE_ADMIN';

ALTER TYPE "SystemRole" RENAME TO "SystemRole_old";
CREATE TYPE "SystemRole" AS ENUM ('SUPER_ADMIN', 'USER');
ALTER TABLE "User" ALTER COLUMN "systemRole" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "systemRole" TYPE "SystemRole" USING ("systemRole"::text::"SystemRole");
ALTER TABLE "User" ALTER COLUMN "systemRole" SET DEFAULT 'USER';
DROP TYPE "SystemRole_old";
