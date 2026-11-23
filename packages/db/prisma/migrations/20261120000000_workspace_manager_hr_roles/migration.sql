-- Additive only: existing members keep their current role.
ALTER TYPE "WorkspaceRole" ADD VALUE IF NOT EXISTS 'MANAGER';
ALTER TYPE "WorkspaceRole" ADD VALUE IF NOT EXISTS 'HR';
