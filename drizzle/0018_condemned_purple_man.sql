PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`unit_system` text DEFAULT 'imperial' NOT NULL,
	`price_mode` text DEFAULT 'average' NOT NULL,
	`average_window_months` integer DEFAULT 6 NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`rounding_mode` text DEFAULT 'cooking' NOT NULL,
	`inventory_view` text DEFAULT 'alphabetical' NOT NULL,
	`list_grouping` text DEFAULT 'grouped' NOT NULL,
	`recipes_per_page` integer DEFAULT 10 NOT NULL,
	`ingredients_per_page` integer DEFAULT 25 NOT NULL,
	`anthropic_api_key` text,
	`has_seen_welcome` integer DEFAULT false NOT NULL,
	`show_recipe_images` integer DEFAULT true NOT NULL,
	`show_locations` integer DEFAULT true NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_settings`("id", "unit_system", "price_mode", "average_window_months", "currency", "rounding_mode", "inventory_view", "list_grouping", "recipes_per_page", "ingredients_per_page", "anthropic_api_key", "has_seen_welcome", "show_recipe_images", "show_locations", "updated_at") SELECT "id", "unit_system", "price_mode", "average_window_months", "currency", "rounding_mode", "inventory_view", "list_grouping", "recipes_per_page", "ingredients_per_page", "anthropic_api_key", "has_seen_welcome", "show_recipe_images", "show_locations", "updated_at" FROM `settings`;--> statement-breakpoint
DROP TABLE `settings`;--> statement-breakpoint
ALTER TABLE `__new_settings` RENAME TO `settings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
-- list_grouping's old 'location' value is renamed to 'grouped': the grouping
-- axis (location vs. category) is now decided by show_locations instead of
-- being baked into this value.
UPDATE `settings` SET `list_grouping` = 'grouped' WHERE `list_grouping` = 'location';