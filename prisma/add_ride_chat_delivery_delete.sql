-- Ride chat: soft delete + delivery timestamps (Flutter + legacy clients).
-- Run against the same DB as Prisma (table `ride_chat_messages`).

ALTER TABLE `ride_chat_messages`
  ADD COLUMN `delivered_at` TIMESTAMP NULL DEFAULT NULL AFTER `read_at`,
  ADD COLUMN `deleted_at` TIMESTAMP NULL DEFAULT NULL AFTER `delivered_at`,
  ADD COLUMN `deleted_by_user_id` INT NULL DEFAULT NULL AFTER `deleted_at`;
