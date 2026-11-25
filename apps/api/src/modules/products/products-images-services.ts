
import { and, count, eq } from "drizzle-orm";

import { db } from "../../infrastructure/database/client.js";

import { getImageKitClient } from "../../infrastructure/imagekit/client.js";

import {
    products,
    productImages,
} from "../../infrastructure/database/schema.js";

import type {
    AttachProductImageInput,
} from "./products-images-validation.js";

const MAX_IMAGES_PER_PRODUCT = 8;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export class ProductImageError extends Error {
    constructor(
        public code:
            | "PRODUCT_NOT_FOUND"
            | "IMAGE_NOT_FOUND"
            | "IMAGE_LIMIT_REACHED"
            | "INVALID_IMAGE"
            | "IMAGE_ALREADY_ATTACHED",
        message: string,
    ) {
        super(message);
        this.name = "ProductImageError";
    }
}

const getProductFolder = (
    sellerId: string,
    productId: string,
) => {
    return `/rewear/sellers/${sellerId}/products/${productId}`;
};

const assertProductOwnership = async (
    sellerId: string,
    productId: string,
) => {
    const [product] = await db
        .select({
            id: products.id,
        })
        .from(products)
        .where(
            and(
                eq(products.id, productId),
                eq(products.sellerId, sellerId),
                eq(products.status, "active"),
            ),
        )
        .limit(1);

    if (!product) {
        throw new ProductImageError(
            "PRODUCT_NOT_FOUND",
            "Product not found",
        );
    }
};

// Generate temporary upload credentials.
export const generateImageUploadAuth = async (
    sellerId: string,
    productId: string,
) => {
    await assertProductOwnership(sellerId, productId);

    const imagekit = getImageKitClient();

    const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;

    if (!publicKey) {
        throw new Error("IMAGEKIT_PUBLIC_KEY is not configured");
    }

    const {
        token,
        expire,
        signature,
    } = imagekit.helper.getAuthenticationParameters();

    return {
        token,
        expire,
        signature,
        publicKey,
        folder: getProductFolder(sellerId, productId),
    };
};

// Attach an uploaded ImageKit file to a product.
export const attachProductImage = async (
    sellerId: string,
    productId: string,
    input: AttachProductImageInput,
) => {
    await assertProductOwnership(sellerId, productId);

    const imagekit = getImageKitClient();

    const [imageCount] = await db
        .select({
            value: count(),
        })
        .from(productImages)
        .where(eq(productImages.productId, productId));

    if (Number(imageCount.value) >= MAX_IMAGES_PER_PRODUCT) {
        throw new ProductImageError(
            "IMAGE_LIMIT_REACHED",
            "A product can have a maximum of 8 images",
        );
    }

    const [existingImage] = await db
        .select({
            id: productImages.id,
        })
        .from(productImages)
        .where(
            eq(
                productImages.imageKitFileId,
                input.fileId,
            ),
        )
        .limit(1);

    if (existingImage) {
        throw new ProductImageError(
            "IMAGE_ALREADY_ATTACHED",
            "This image is already attached to a product",
        );
    }

    // Fetch actual asset metadata from ImageKit.
    // Never trust an image URL supplied by the client.
    const asset = await imagekit.files.get(input.fileId);

    const expectedFolder = getProductFolder(
        sellerId,
        productId,
    );

    const belongsToProduct =
        asset.filePath?.startsWith(`${expectedFolder}/`);

    if (
        asset?.fileType !== "image" ||
        (asset?.size && asset.size > MAX_IMAGE_SIZE) ||
        !belongsToProduct
    ) {
        throw new ProductImageError(
            "INVALID_IMAGE",
            "Image is invalid or does not belong to this product",
        );
    }

    const [image] = await db
        .insert(productImages)
        .values({
            productId: productId as string,
            imageKitFileId: input.fileId as string,
            imageUrl: asset.url as string,
            altText: input.altText ?? null,
            position: input.position,
        } as any)
        .returning();

    return image;
};

// Delete an image owned by the authenticated seller.
export const deleteProductImage = async (
    sellerId: string,
    productId: string,
    imageId: string,
) => {
    const [image] = await db
        .select({
            id: productImages.id,
            imageKitFileId: productImages.imageKitFileId,
        })
        .from(productImages)
        .innerJoin(
            products,
            eq(products.id, productImages.productId),
        )
        .where(
            and(
                eq(products.id, productId),
                eq(products.sellerId, sellerId),
                eq(products.status, "active"),
                eq(productImages.id, imageId),
            ),
        )
        .limit(1);

    if (!image) {
        throw new ProductImageError(
            "IMAGE_NOT_FOUND",
            "Product image not found",
        );
    }

    if (image.imageKitFileId) {
        const imagekit = getImageKitClient();

        await imagekit.files.delete(image.imageKitFileId);
    }

    await db
        .delete(productImages)
        .where(eq(productImages.id, imageId));

    return {
        id: image.id,
    };
};
