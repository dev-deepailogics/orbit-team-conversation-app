-- A to-do created from a message keeps a link back to it (message://<channelId>/<messageId>[/<parentMessageId>]).
ALTER TABLE "todos" ADD COLUMN "message_link" TEXT;
