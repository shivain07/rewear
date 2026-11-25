
import type { RequestHandler } from "express";

import {
    productImageParamsSchema,
    deleteProductImageParamsSchema,
    attachProductImageSchema,
} from "./products-images-validation.js";
import type { AuthContext } from "../auth/auth.types.js";

import {
    generateImageUploadAuth,
    attachProductImage,
    deleteProductImage,
    ProductImageError,
} from "./products-images-services.js";

const handleImageError = (
    error: unknown,
    next: Parameters<RequestHandler>[2],
    res: Parameters<RequestHandler>[1],
) => {
    if (error instanceof ProductImageError) {
        const statusMap = {
            PRODUCT_NOT_FOUND: 404,
            IMAGE_NOT_FOUND: 404,
            IMAGE_LIMIT_REACHED: 409,
            INVALID_IMAGE: 400,
            IMAGE_ALREADY_ATTACHED: 409,
        };

        res.status(statusMap[error.code]).json({
            success: false,
            message: error.message,
        });

        return;
    }

    next(error);
};

export const generateUploadAuth: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const auth = res.locals.auth as AuthContext;
        const parsedParams = productImageParamsSchema.safeParse(
            req.params,
        );

        if (!parsedParams.success) {
            res.status(400).json({
                success: false,
                message: "Invalid product ID",
            });
            return;
        }

        const result = await generateImageUploadAuth(
            auth.userId,
            parsedParams.data.id,
        );

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        handleImageError(error, next, res);
    }
};

export const attachImage: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const auth = res.locals.auth as AuthContext;
        const parsedParams = productImageParamsSchema.safeParse(
            req.params,
        );

        if (!parsedParams.success) {
            res.status(400).json({
                success: false,
                message: "Invalid product ID",
            });
            return;
        }

        const parsedBody = attachProductImageSchema.safeParse(
            req.body,
        );

        if (!parsedBody.success) {
            res.status(400).json({
                success: false,
                errors: parsedBody.error.flatten(),
            });
            return;
        }

        const image = await attachProductImage(
            auth.userId,
            parsedParams.data.id,
            parsedBody.data,
        );

        res.status(201).json({
            success: true,
            data: image,
        });
    } catch (error) {
        handleImageError(error, next, res);
    }
};

export const removeImage: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const parsedParams =
            deleteProductImageParamsSchema.safeParse(req.params);

        if (!parsedParams.success) {
            res.status(400).json({
                success: false,
                message: "Invalid product or image ID",
            });
            return;
        }
        const auth = res.locals.auth as AuthContext;
        const result = await deleteProductImage(
            auth.userId,
            parsedParams.data.id,
            parsedParams.data.imageId,
        );

        res.json({
            success: true,
            message: "Product image deleted successfully",
            data: result,
        });
    } catch (error) {
        handleImageError(error, next, res);
    }
};
