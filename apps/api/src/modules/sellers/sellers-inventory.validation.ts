import { z } from "zod";

export const sellerProductsQuerySchema = z.object({
    status: z.enum(["all", "active", "archived"]).default("all"),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().optional(),
});

export const updateStockSchema = z.object({
    stock: z.number().int().min(0),
});

export type SellerProductsQuery = z.infer<
    typeof sellerProductsQuerySchema
>;

export type UpdateStockInput = z.infer<
    typeof updateStockSchema
>;