CREATE INDEX `ri_ingredient_idx` ON `recipe_ingredients` (`ingredient_id`);--> statement-breakpoint
CREATE INDEX `rt_recipe_idx` ON `recipe_tags` (`recipe_id`);--> statement-breakpoint
CREATE INDEX `rt_tag_idx` ON `recipe_tags` (`tag_id`);