
import { z } from "zod";

export const attachProductImageSchema = z.object({
    fileId: z.string().trim().min(1).max(255),

    altText: z.string().trim().max(255).nullable().optional(),

    position: z.number().int().min(0).max(7).default(0),
});

export const productImageParamsSchema = z.object({
    id: z.string().uuid(),
});

export const deleteProductImageParamsSchema = z.object({
    id: z.string().uuid(),
    imageId: z.string().uuid(),
});

export type AttachProductImageInput = z.infer<
    typeof attachProductImageSchema
>;
