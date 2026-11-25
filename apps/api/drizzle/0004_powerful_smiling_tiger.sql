DROP INDEX "products_status_created_at_idx";--> statement-breakpoint
CREATE INDEX "products_status_created_at_idx" ON "products" USING btree ("status","created_at","id");