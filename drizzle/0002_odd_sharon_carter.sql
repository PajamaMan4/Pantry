CREATE TABLE `shopping_list_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ingredient_id` integer,
	`name` text NOT NULL,
	`quantity` real,
	`unit` text,
	`price` real,
	`checked` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `recipes` ADD `rating` integer;--> statement-breakpoint
ALTER TABLE `settings` ADD `anthropic_api_key` text;