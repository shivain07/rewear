
import { z } from "zod";

export const createSellerProfileSchema = z.object({
    shopName: z.string()
        .trim()
        .min(3, "Shop name must have at least 3 characters")
        .max(100),

    bio: z.string()
        .trim()
        .max(500)
        .nullable()
        .optional(),

    location: z.string()
        .trim()
        .max(150)
        .nullable()
        .optional(),
});

export const updateSellerProfileSchema = z.object({
    shopName: z.string()
        .trim()
        .min(3)
        .max(100)
        .optional(),

    bio: z.string()
        .trim()
        .max(500)
        .nullable()
        .optional(),

    location: z.string()
        .trim()
        .max(150)
        .nullable()
        .optional(),
}).refine(
    (data) => Object.keys(data).length > 0,
    {
        message: "At least one field must be provided",
    },
);

export type CreateSellerProfileInput = z.infer<
    typeof createSellerProfileSchema
>;

export type UpdateSellerProfileInput = z.infer<
    typeof updateSellerProfileSchema
>;
