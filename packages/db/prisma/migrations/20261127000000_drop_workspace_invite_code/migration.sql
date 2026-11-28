-- Invite links were removed; members are only added directly by an admin.
DROP INDEX "Workspace_inviteCode_key";
ALTER TABLE "Workspace" DROP COLUMN "inviteCode";
