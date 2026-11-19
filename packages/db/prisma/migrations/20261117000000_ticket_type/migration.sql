-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('TASK', 'BUG', 'STORY', 'EPIC');

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "type" "TicketType" NOT NULL DEFAULT 'TASK';

