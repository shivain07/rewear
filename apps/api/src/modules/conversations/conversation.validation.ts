import { z } from "zod";

export const conversationIdSchema = z.object({
    id: z.string().uuid(),
});

export const sendMessageSchema = z.object({
    body: z.string().trim().min(1).max(2000),
});

export const getMessagesQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(50).default(30),
    before: z.string().uuid().optional(),
});