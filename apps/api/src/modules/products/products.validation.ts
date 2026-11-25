
import { z } from "zod";

export const createProductSchema = z.object({
    title: z.string().trim().min(3).max(200),

    description: z.string().trim().max(5000).nullable().optional(),

    // Whole rupees only. No decimal values.
    price: z.number().int().positive(),

    stock: z.number().int().min(0).default(1),

    category: z.string().trim().min(1).max(80),

    size: z.string().trim().max(30).nullable().optional(),

    condition: z.enum([
        "new",
        "like_new",
        "good",
        "fair",
    ]),

    listingType: z.enum([
        "sale",
        "rent",
    ]),
});

export const updateProductSchema = createProductSchema
    .partial()
    .refine(
        (data) => Object.keys(data).length > 0,
        {
            message: "At least one field must be provided",
        },
    );

export const browseProductsSchema = z.object({
    category: z.string().trim().min(1).max(80).optional(),

    size: z.string().trim().min(1).max(30).optional(),

    condition: z.enum([
        "new",
        "like_new",
        "good",
        "fair",
    ]).optional(),

    listingType: z.enum([
        "sale",
        "rent",
    ]).optional(),

    minPrice: z.coerce.number().int().min(1).optional(),

    maxPrice: z.coerce.number().int().min(1).optional(),

    limit: z.coerce.number().int().min(1).max(50).default(20),

    cursor: z.string().min(1).optional(),
    q: z.string().trim().min(1).max(100).optional(),
    sort: z
        .enum(["newest", "price_asc", "price_desc"])
        .default("newest"),

}).refine(
    (data) =>
        data.minPrice === undefined ||
        data.maxPrice === undefined ||
        data.minPrice <= data.maxPrice,
    {
        message: "minPrice cannot be greater than maxPrice",
        path: ["minPrice"],
    },
);

export type BrowseProductsInput = z.infer<
    typeof browseProductsSchema
>;

export const productIdSchema = z.string().uuid();

export type CreateProductInput = z.infer<
    typeof createProductSchema
>;

export type UpdateProductInput = z.infer<
    typeof updateProductSchema
>;
