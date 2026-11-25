
import {
    and,
    asc,
    desc,
    eq,
    gt,
    gte,
    ilike,
    inArray,
    lt,
    lte,
    or,
    type SQL
} from "drizzle-orm";

import { db } from "../../infrastructure/database/client.js";
import {
    decodeCursor,
    encodeCursor,
} from "./products.pagination.js";

import {
    decodeBrowseCursor,
    encodeBrowseCursor,
} from "./products.pagination.js";

import {
    productImages,
    products,
    sellerProfiles,
} from "../../infrastructure/database/schema.js";

import type {
    BrowseProductsInput,
    CreateProductInput,
    UpdateProductInput,
} from "./products.validation.js";

import {
    getProductImageVariants,
} from "../../infrastructure/imagekit/imagekit.utils.js";

export class ProductError extends Error {
    constructor(
        public code: "SELLER_PROFILE_REQUIRED" | "PRODUCT_NOT_FOUND",
        message: string,
    ) {
        super(message);
        this.name = "ProductError";
    }
}

// Create a product for the authenticated seller.
export async function createProduct(
    sellerId: string,
    input: CreateProductInput,
) {
    const [profile] = await db
        .select({
            userId: sellerProfiles.userId,
        })
        .from(sellerProfiles)
        .where(eq(sellerProfiles.userId, sellerId))
        .limit(1);

    if (!profile) {
        throw new ProductError(
            "SELLER_PROFILE_REQUIRED",
            "Create a seller profile before listing products",
        );
    }

    const [product] = await db
        .insert(products)
        .values({
            sellerId,
            title: input.title,
            description: input.description ?? null,
            price: input.price,
            stock: input.stock,
            category: input.category,
            size: input.size ?? null,
            condition: input.condition,
            listingType: input.listingType,
            status: "active",
        })
        .returning();

    return product;
}


const getImagesForProducts = async (
    productIds: string[],
) => {
    if (productIds.length === 0) {
        return new Map();
    }

    const images = await db
        .select({
            id: productImages.id,
            productId: productImages.productId,
            imageUrl: productImages.imageUrl,
            altText: productImages.altText,
            position: productImages.position,
            createdAt: productImages.createdAt,
        })
        .from(productImages)
        .where(
            inArray(productImages.productId, productIds),
        )
        .orderBy(
            asc(productImages.position),
            asc(productImages.createdAt),
        );

    const imagesByProduct = new Map();

    for (const image of images) {
        const variants = getProductImageVariants(
            image.imageUrl,
        );

        const formattedImage = {
            id: image.id,
            imageUrl: variants.original,
            thumbnailUrl: variants.thumbnail,
            detailUrl: variants.detail,
            altText: image.altText,
            position: image.position,
        };

        const existing = imagesByProduct.get(image.productId) ?? [];

        existing.push(formattedImage);

        imagesByProduct.set(
            image.productId,
            existing,
        );
    }

    return imagesByProduct;
};


// Browse active products.

export async function getProducts(
    filters: BrowseProductsInput,
) {
    const conditions: SQL[] = [
        eq(products.status, "active"),
        gt(products.stock, 0),
    ];

    if (filters.q) {
        // Treat %, _ and \ as literal search characters.
        const escapedQuery = filters.q.replace(
            /[\\%_]/g,
            "\\$&",
        );

        const searchPattern = `%${escapedQuery}%`;

        conditions.push(
            or(
                ilike(products.title, searchPattern),
                ilike(products.description, searchPattern),
            )!,
        );
    }

    if (filters.category) {
        conditions.push(
            eq(products.category, filters.category),
        );
    }

    if (filters.size) {
        conditions.push(
            eq(products.size, filters.size),
        );
    }

    if (filters.condition) {
        conditions.push(
            eq(products.condition, filters.condition),
        );
    }

    if (filters.listingType) {
        conditions.push(
            eq(products.listingType, filters.listingType),
        );
    }

    if (filters.minPrice !== undefined) {
        conditions.push(
            gte(products.price, filters.minPrice),
        );
    }

    if (filters.maxPrice !== undefined) {
        conditions.push(
            lte(products.price, filters.maxPrice),
        );
    }

    // Decode the cursor when requesting another page.
    if (filters.cursor) {
        const cursor = decodeBrowseCursor(filters.cursor);

        if (cursor.sort !== filters.sort) {
            throw new Error(
                "Pagination cursor does not match the selected sort order",
            );
        }

        if (cursor.sort === "newest") {
            const cursorDate = new Date(cursor.createdAt);

            conditions.push(
                or(
                    lt(products.createdAt, cursorDate),
                    and(
                        eq(products.createdAt, cursorDate),
                        lt(products.id, cursor.id),
                    ),
                )!,
            );
        }

        if (cursor.sort === "price_asc") {
            conditions.push(
                or(
                    gt(products.price, cursor.price),
                    and(
                        eq(products.price, cursor.price),
                        gt(products.id, cursor.id),
                    ),
                )!,
            );
        }

        if (cursor.sort === "price_desc") {
            conditions.push(
                or(
                    lt(products.price, cursor.price),
                    and(
                        eq(products.price, cursor.price),
                        lt(products.id, cursor.id),
                    ),
                )!,
            );
        }

    }

    const orderBy = filters.sort === "price_asc"
        ? [asc(products.price), asc(products.id)]
        : filters.sort === "price_desc"
            ? [desc(products.price), desc(products.id)]
            : [desc(products.createdAt), desc(products.id)];


    const rows = await db
        .select()
        .from(products)
        .where(and(...conditions))
        .orderBy(...orderBy)
        .limit(filters.limit + 1);

    const hasMore = rows.length > filters.limit;
    const items = rows.slice(0, filters.limit);

    const lastItem = items.at(-1);

    let nextCursor: string | null = null;

    if (hasMore && lastItem) {
        if (filters.sort === "newest") {
            nextCursor = encodeBrowseCursor({
                sort: "newest",
                createdAt: lastItem.createdAt.toISOString(),
                id: lastItem.id,
            });
        } else if (filters.sort === "price_asc") {
            nextCursor = encodeBrowseCursor({
                sort: "price_asc",
                price: lastItem.price,
                id: lastItem.id,
            });
        } else {
            nextCursor = encodeBrowseCursor({
                sort: "price_desc",
                price: lastItem.price,
                id: lastItem.id,
            });
        }
    }


    // another page exists.
    // const rows = await db
    //     .select()
    //     .from(products)
    //     .where(and(...conditions))
    //     .orderBy(
    //         desc(products.createdAt),
    //         desc(products.id),
    //     )
    //     .limit(filters.limit + 1);

    // const hasMore = rows.length > filters.limit;

    // const items = rows.slice(0, filters.limit);

    // const lastItem = items.at(-1);

    // const nextCursor =
    //     hasMore && lastItem
    //         ? encodeCursor({
    //             createdAt: lastItem.createdAt.toISOString(),
    //             id: lastItem.id,
    //         })
    //         : null;

    const imagesByProduct = await getImagesForProducts(
        items.map((product) => product.id),
    );

    const productsWithImages = items.map((product) => ({
        ...product,
        images: imagesByProduct.get(product.id) ?? [],
    }));

    return {
        items: productsWithImages,
        pagination: {
            limit: filters.limit,
            hasMore,
            nextCursor,
        },
    };
}


// Get one active product.
export async function getProductById(id: string) {
    const [product] = await db
        .select()
        .from(products)
        .where(
            and(
                eq(products.id, id),
                eq(products.status, "active"),
            ),
        )
        .limit(1);

    if (!product) {
        throw new ProductError(
            "PRODUCT_NOT_FOUND",
            "Product not found",
        );
    }

    const imagesByProduct = await getImagesForProducts([
        product.id,
    ]);

    return {
        ...product,
        images: imagesByProduct.get(product.id) ?? [],
    };
}

// Update only if this seller owns the active product.
export async function updateProduct(
    sellerId: string,
    productId: string,
    input: UpdateProductInput,
) {
    const [product] = await db
        .update(products)
        .set({
            ...input,
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(products.id, productId),
                eq(products.sellerId, sellerId),
                eq(products.status, "active"),
            ),
        )
        .returning();

    if (!product) {
        throw new ProductError(
            "PRODUCT_NOT_FOUND",
            "Product not found",
        );
    }

    return product;
}

// Archive instead of permanently deleting.
export async function archiveProduct(
    sellerId: string,
    productId: string,
) {
    const [product] = await db
        .update(products)
        .set({
            status: "archived",
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(products.id, productId),
                eq(products.sellerId, sellerId),
                eq(products.status, "active"),
            ),
        )
        .returning();

    if (!product) {
        throw new ProductError(
            "PRODUCT_NOT_FOUND",
            "Product not found",
        );
    }

    return product;
}
