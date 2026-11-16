-- api.dicebear.com is non-commercial only; avatars are now served by our own /api/avatar route (same path shape).
UPDATE "User" SET "avatarUrl" = replace("avatarUrl", 'https://api.dicebear.com/7.x/', '/api/avatar/') WHERE "avatarUrl" LIKE 'https://api.dicebear.com/7.x/%';
UPDATE "Workspace" SET "iconUrl" = replace("iconUrl", 'https://api.dicebear.com/7.x/', '/api/avatar/') WHERE "iconUrl" LIKE 'https://api.dicebear.com/7.x/%';
UPDATE "BotApp" SET "avatarUrl" = replace("avatarUrl", 'https://api.dicebear.com/7.x/', '/api/avatar/') WHERE "avatarUrl" LIKE 'https://api.dicebear.com/7.x/%';
-- adventurer and fun-emoji are CC BY 4.0 (need attribution): move them to CC0 styles.
UPDATE "User" SET "avatarUrl" = replace(replace("avatarUrl", '/api/avatar/adventurer/', '/api/avatar/open-peeps/'), '/api/avatar/fun-emoji/', '/api/avatar/thumbs/') WHERE "avatarUrl" LIKE '/api/avatar/adventurer/%' OR "avatarUrl" LIKE '/api/avatar/fun-emoji/%';
