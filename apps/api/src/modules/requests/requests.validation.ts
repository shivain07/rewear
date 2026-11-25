import { z } from "zod";

export const createRequestSchema = z.object({
    productId: z.string().uuid(),

    type: z.enum(["purchase", "rent"]),

    message: z
        .string()
        .trim()
        .min(1, "Message is required")
        .max(1000, "Message cannot exceed 1000 characters"),
});

export type CreateRequestInput = z.infer<
    typeof createRequestSchema
>;