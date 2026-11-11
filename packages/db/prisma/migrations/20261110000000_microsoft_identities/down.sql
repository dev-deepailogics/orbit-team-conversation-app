-- Rollback for 20261110000000_microsoft_identities. Prisma never runs this file; apply manually:
--   npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20261110000000_microsoft_identities/down.sql
-- Fails if Microsoft-only users (NULL passwordHash) exist — delete them or set a password first.
DROP TABLE "user_identities";
ALTER TABLE "User" ALTER COLUMN "passwordHash" SET NOT NULL;
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261110000000_microsoft_identities';
