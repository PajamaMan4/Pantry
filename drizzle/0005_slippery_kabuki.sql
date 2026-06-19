CREATE TABLE `ingredient_aliases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ingredient_id` integer NOT NULL,
	`alias` text NOT NULL,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ingredient_aliases_alias_unique` ON `ingredient_aliases` (`alias`);--> statement-breakpoint
CREATE INDEX `alias_ing_idx` ON `ingredient_aliases` (`ingredient_id`);