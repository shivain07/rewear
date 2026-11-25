
import { z } from "zod";

const cursorPayloadSchema = z.object({
    createdAt: z.string().datetime(),
    id: z.string().uuid(),
});

export type ProductCursor = z.infer<
    typeof cursorPayloadSchema
>;

export class InvalidCursorError extends Error {
    constructor() {
        super("Invalid pagination cursor");
        this.name = "InvalidCursorError";
    }
}

export function encodeCursor(cursor: ProductCursor): string {
    return Buffer
        .from(JSON.stringify(cursor))
        .toString("base64url");
}

export function decodeCursor(value: string): ProductCursor {
    try {
        const decoded = Buffer
            .from(value, "base64url")
            .toString("utf8");

        const parsed = JSON.parse(decoded);
        const result = cursorPayloadSchema.safeParse(parsed);

        if (!result.success) {
            throw new InvalidCursorError();
        }

        return result.data;
    } catch {
        throw new InvalidCursorError();
    }
}

const browseCursorSchema = z.discriminatedUnion("sort", [
    z.object({
        sort: z.literal("newest"),
        createdAt: z.string().datetime(),
        id: z.string().uuid(),
    }),

    z.object({
        sort: z.literal("price_asc"),
        price: z.number().int(),
        id: z.string().uuid(),
    }),

    z.object({
        sort: z.literal("price_desc"),
        price: z.number().int(),
        id: z.string().uuid(),
    }),
]);

export type BrowseCursor = z.infer<
    typeof browseCursorSchema
>;

export const encodeBrowseCursor = (
    cursor: BrowseCursor,
) => {
    return Buffer.from(
        JSON.stringify(cursor),
    ).toString("base64url");
};

export const decodeBrowseCursor = (
    value: string,
): BrowseCursor => {
    try {
        const decoded = JSON.parse(
            Buffer.from(value, "base64url").toString("utf8"),
        );

        return browseCursorSchema.parse(decoded);
    } catch {
        throw new Error("Invalid pagination cursor");
    }
};