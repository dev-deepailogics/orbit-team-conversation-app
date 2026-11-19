-- Per-user notification preference for a channel/DM/group DM. Scoped to
-- ChannelMember so it works uniformly across every channel type without
-- special-casing. Three states instead of a plain boolean: "ALL" (default,
-- every new post), "MENTIONS" (only when the user is @mentioned), and
-- "MUTED" (never).
CREATE TYPE "NotificationPreference" AS ENUM ('ALL', 'MENTIONS', 'MUTED');
ALTER TABLE "ChannelMember" ADD COLUMN "notificationPreference" "NotificationPreference" NOT NULL DEFAULT 'ALL';
 