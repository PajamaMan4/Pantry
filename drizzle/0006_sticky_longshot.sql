CREATE TABLE `recipe_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `recipes` ADD `group_id` integer REFERENCES recipe_groups(id);