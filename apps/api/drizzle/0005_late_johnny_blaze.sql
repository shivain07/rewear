ALTER TABLE "product_images" ALTER COLUMN "alt_text" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "product_images" ADD COLUMN "imagekit_file_id" varchar(255);--> statement-breakpoint
CREATE UNIQUE INDEX "product_images_imagekit_file_id_unique" ON "product_images" USING btree ("imagekit_file_id");
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS products_title_trgm_idx
ON products USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS products_description_trgm_idx
ON products USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS products_status_created_id_idx
ON products (status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS products_status_price_id_idx
ON products (status, price ASC, id ASC);