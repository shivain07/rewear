import {
    and,
    count,
    desc,
    eq,
    lt,
    ne,
    or,
    sql,
} from "drizzle-orm";

import { db } from "../../infrastructure/database/client.js";
import { products } from "../../infrastructure/database/schema.js";

import type {
    SellerProductsQuery,
    UpdateStockInput,
} from "./sellers-inventory.validation.js";

import { decodeCursor } from "../products/products.pagination.js";

export class SellerInventoryError extends Error {
    constructor(
        message: string,
        public statusCode: number,
    ) {
        super(message);
        this.name = "SellerInventoryError";
    }
}

export const getSellerDashboard = async (sellerId: string) => {
    const [stats] = await db
        .select({
            totalProducts: count(),
            activeProducts: sql<number>`
                count(*) filter (
                    where ${products.status} = 'active'
                )
            `,
            outOfStockProducts: sql<number>`
                count(*) filter (
                    where ${products.status} = 'active'
                    and ${products.stock} = 0
                )
            `,
            archivedProducts: sql<number>`
                count(*) filter (
                    where ${products.status} = 'archived'
                )
            `,
            totalStock: sql<number>`
                coalesce(
                    sum(${products.stock}) filter (
                        where ${products.status} = 'active'
                    ),
                    0
                )
            `,
        })
        .from(products)
        .where(eq(products.sellerId, sellerId));

    return {
        totalProducts: Number(stats.totalProducts),
        activeProducts: Number(stats.activeProducts),
        outOfStockProducts: Number(stats.outOfStockProducts),
        archivedProducts: Number(stats.archivedProducts),
        totalStock: Number(stats.totalStock),
    };
};

export const getSellerProducts = async (
    sellerId: string,
    filters: SellerProductsQuery,
) => {
    const conditions = [
        eq(products.sellerId, sellerId),
    ];

    if (filters.status !== "all") {
        conditions.push(
            eq(products.status, filters.status),
        );
    }

    if (filters.cursor) {
        const cursor = decodeCursor(filters.cursor);

        conditions.push(
            or(
                lt(products.createdAt, new Date(cursor.createdAt)),
                and(
                    eq(products.createdAt, new Date(cursor.createdAt)),
                    lt(products.id, cursor.id),
                ),
            )!,
        );
    }

    const rows = await db
        .select()
        .from(products)
        .where(and(...conditions))
        .orderBy(
            desc(products.createdAt),
            desc(products.id),
        )
        .limit(filters.limit + 1);

    const hasMore = rows.length > filters.limit;
    const items = rows.slice(0, filters.limit);

    const lastItem = items.at(-1);

    const nextCursor =
        hasMore && lastItem
            ? Buffer.from(
                JSON.stringify({
                    createdAt: lastItem.createdAt.toISOString(),
                    id: lastItem.id,
                }),
            ).toString("base64url")
            : null;

    return {
        items,
        pagination: {
            limit: filters.limit,
            hasMore,
            nextCursor,
        },
    };
};

export const updateSellerProductStock = async (
    sellerId: string,
    productId: string,
    input: UpdateStockInput,
) => {
    const [updatedProduct] = await db
        .update(products)
        .set({
            stock: input.stock,
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(products.id, productId),
                eq(products.sellerId, sellerId),
                ne(products.status, "archived"),
            ),
        )
        .returning();

    if (!updatedProduct) {
        throw new SellerInventoryError(
            "Product not found or cannot be updated",
            404,
        );
    }

    return updatedProduct;
};