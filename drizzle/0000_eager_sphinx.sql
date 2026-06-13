CREATE TABLE `cook_log_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cook_log_id` integer NOT NULL,
	`inventory_item_id` integer,
	`ingredient_id` integer NOT NULL,
	`amount_deducted` real NOT NULL,
	`unit` text NOT NULL,
	FOREIGN KEY (`cook_log_id`) REFERENCES `cook_logs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `cook_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipe_id` integer,
	`recipe_name` text,
	`servings_made` real NOT NULL,
	`total_cost` real,
	`cooked_at` integer NOT NULL,
	`notes` text,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `ingredients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`default_unit` text,
	`density` real,
	`is_staple` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ingredients_name_unique` ON `ingredients` (`name`);--> statement-breakpoint
CREATE TABLE `inventory_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ingredient_id` integer NOT NULL,
	`location_id` integer,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`expiry_date` integer,
	`opened_date` integer,
	`notes` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `storage_locations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `inv_ing_idx` ON `inventory_items` (`ingredient_id`);--> statement-breakpoint
CREATE TABLE `price_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ingredient_id` integer NOT NULL,
	`price` real NOT NULL,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`store` text,
	`purchased_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `price_ing_idx` ON `price_entries` (`ingredient_id`);--> statement-breakpoint
CREATE TABLE `recipe_ingredients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipe_id` integer NOT NULL,
	`ingredient_id` integer NOT NULL,
	`amount` real,
	`amount_max` real,
	`unit` text,
	`raw` text,
	`prep` text,
	`optional` integer DEFAULT false NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ri_recipe_idx` ON `recipe_ingredients` (`recipe_id`);--> statement-breakpoint
CREATE TABLE `recipe_tags` (
	`recipe_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`steps` text DEFAULT '[]' NOT NULL,
	`prep_time_min` integer,
	`cook_time_min` integer,
	`base_servings` real DEFAULT 1 NOT NULL,
	`notes` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`unit_system` text DEFAULT 'imperial' NOT NULL,
	`price_mode` text DEFAULT 'average' NOT NULL,
	`average_window_months` integer DEFAULT 6 NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`rounding_mode` text DEFAULT 'cooking' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `storage_locations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `storage_locations_name_unique` ON `storage_locations` (`name`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);