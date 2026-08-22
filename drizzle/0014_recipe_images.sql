CREATE TABLE `recipe_images` (
	`recipe_id` integer PRIMARY KEY NOT NULL,
	`mime` text NOT NULL,
	`bytes` blob NOT NULL,
	`width` integer,
	`height` integer,
	`byte_size` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `settings` ADD `show_recipe_images` integer DEFAULT true NOT NULL;