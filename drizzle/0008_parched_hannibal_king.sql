CREATE TABLE `tombstones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity` text NOT NULL,
	`public_id` text NOT NULL,
	`deleted_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tombstone_entity_idx` ON `tombstones` (`entity`,`public_id`);--> statement-breakpoint
-- New columns are added NULLABLE, then backfilled, so this migration succeeds on an
-- already-populated database (SQLite cannot ADD a NOT NULL column without a constant
-- default, and a constant default would break the UNIQUE constraint on public_id).
-- publicId is backfilled with a random 16-byte hex value (format is irrelevant — only
-- uniqueness matters); the app's $defaultFn(newPublicId) populates all new rows.
-- updated_at is backfilled to "now" in Unix seconds (Drizzle timestamp mode).
ALTER TABLE `cook_logs` ADD `public_id` text;--> statement-breakpoint
UPDATE `cook_logs` SET `public_id` = lower(hex(randomblob(16))) WHERE `public_id` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `cook_logs_public_id_unique` ON `cook_logs` (`public_id`);--> statement-breakpoint
ALTER TABLE `ingredient_aliases` ADD `public_id` text;--> statement-breakpoint
UPDATE `ingredient_aliases` SET `public_id` = lower(hex(randomblob(16))) WHERE `public_id` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `ingredient_aliases_public_id_unique` ON `ingredient_aliases` (`public_id`);--> statement-breakpoint
ALTER TABLE `ingredients` ADD `public_id` text;--> statement-breakpoint
UPDATE `ingredients` SET `public_id` = lower(hex(randomblob(16))) WHERE `public_id` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `ingredients_public_id_unique` ON `ingredients` (`public_id`);--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `public_id` text;--> statement-breakpoint
UPDATE `inventory_items` SET `public_id` = lower(hex(randomblob(16))) WHERE `public_id` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_items_public_id_unique` ON `inventory_items` (`public_id`);--> statement-breakpoint
ALTER TABLE `price_entries` ADD `public_id` text;--> statement-breakpoint
UPDATE `price_entries` SET `public_id` = lower(hex(randomblob(16))) WHERE `public_id` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `price_entries_public_id_unique` ON `price_entries` (`public_id`);--> statement-breakpoint
ALTER TABLE `recipe_groups` ADD `public_id` text;--> statement-breakpoint
ALTER TABLE `recipe_groups` ADD `updated_at` integer;--> statement-breakpoint
UPDATE `recipe_groups` SET `public_id` = lower(hex(randomblob(16))) WHERE `public_id` IS NULL;--> statement-breakpoint
UPDATE `recipe_groups` SET `updated_at` = (strftime('%s','now')) WHERE `updated_at` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_groups_public_id_unique` ON `recipe_groups` (`public_id`);--> statement-breakpoint
ALTER TABLE `recipes` ADD `public_id` text;--> statement-breakpoint
UPDATE `recipes` SET `public_id` = lower(hex(randomblob(16))) WHERE `public_id` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `recipes_public_id_unique` ON `recipes` (`public_id`);--> statement-breakpoint
ALTER TABLE `settings` ADD `updated_at` integer;--> statement-breakpoint
UPDATE `settings` SET `updated_at` = (strftime('%s','now')) WHERE `updated_at` IS NULL;--> statement-breakpoint
ALTER TABLE `shopping_list_items` ADD `public_id` text;--> statement-breakpoint
ALTER TABLE `shopping_list_items` ADD `updated_at` integer;--> statement-breakpoint
UPDATE `shopping_list_items` SET `public_id` = lower(hex(randomblob(16))) WHERE `public_id` IS NULL;--> statement-breakpoint
UPDATE `shopping_list_items` SET `updated_at` = (strftime('%s','now')) WHERE `updated_at` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `shopping_list_items_public_id_unique` ON `shopping_list_items` (`public_id`);--> statement-breakpoint
ALTER TABLE `storage_locations` ADD `public_id` text;--> statement-breakpoint
ALTER TABLE `storage_locations` ADD `updated_at` integer;--> statement-breakpoint
UPDATE `storage_locations` SET `public_id` = lower(hex(randomblob(16))) WHERE `public_id` IS NULL;--> statement-breakpoint
UPDATE `storage_locations` SET `updated_at` = (strftime('%s','now')) WHERE `updated_at` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `storage_locations_public_id_unique` ON `storage_locations` (`public_id`);--> statement-breakpoint
ALTER TABLE `tags` ADD `public_id` text;--> statement-breakpoint
ALTER TABLE `tags` ADD `updated_at` integer;--> statement-breakpoint
UPDATE `tags` SET `public_id` = lower(hex(randomblob(16))) WHERE `public_id` IS NULL;--> statement-breakpoint
UPDATE `tags` SET `updated_at` = (strftime('%s','now')) WHERE `updated_at` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `tags_public_id_unique` ON `tags` (`public_id`);
