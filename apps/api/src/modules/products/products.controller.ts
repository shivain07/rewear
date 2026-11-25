
import type {
    Request,
    Response,
    NextFunction,
    RequestHandler,
} from "express";

import {
    createProductSchema,
    updateProductSchema,
    productIdSchema,
} from "./products.validation.js";

import {
    browseProductsSchema,
} from "./products.validation.js";

import {
    InvalidCursorError,
} from "./products.pagination.js";

import {
    createProduct as createProductService,
    getProducts as getProductsService,
    getProductById as getProductByIdService,
    updateProduct as updateProductService,
    archiveProduct as archiveProductService,
    ProductError,
} from "./products.service.js";
import { AuthContext } from "../auth/auth.types.js";

function handleError(
    error: unknown,
    res: Response,
    next: NextFunction,
) {
    if (error instanceof ProductError) {
        const status =
            error.code === "SELLER_PROFILE_REQUIRED"
                ? 403
                : 404;

        res.status(status).json({
            success: false,
            message: error.message,
        });

        return;
    }

    next(error);
}

export const createProduct: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const auth = res.locals.auth as AuthContext;

        const parsed = createProductSchema.safeParse(req.body);

        if (!parsed.success) {
            res.status(400).json({
                success: false,
                errors: parsed.error.flatten(),
            });
            return;
        }

        const product = await createProductService(
            auth.userId,
            parsed.data,
        );

        res.status(201).json({
            success: true,
            data: product,
        });
    } catch (error) {
        handleError(error, res, next);
    }
}

export const getProducts: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const parsed = browseProductsSchema.safeParse(req.query);

        if (!parsed.success) {
            res.status(400).json({
                success: false,
                errors: parsed.error.flatten(),
            });
            return;
        }

        const result = await getProductsService(parsed.data);

        res.json({
            success: true,
            data: result.items,
            pagination: result.pagination,
        });
    } catch (error) {
        if (error instanceof InvalidCursorError) {
            res.status(400).json({
                success: false,
                message: error.message,
            });
            return;
        }

        next(error);
    }
}

export async function getProductById(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const parsedId = productIdSchema.safeParse(req.params.id);

        if (!parsedId.success) {
            res.status(400).json({
                success: false,
                message: "Invalid product ID",
            });
            return;
        }

        const product = await getProductByIdService(parsedId.data);

        res.json({
            success: true,
            data: product,
        });
    } catch (error) {
        handleError(error, res, next);
    }
}

export const updateProduct: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const parsedId = productIdSchema.safeParse(req.params.id);

        if (!parsedId.success) {
            res.status(400).json({
                success: false,
                message: "Invalid product ID",
            });
            return;
        }

        const parsedBody = updateProductSchema.safeParse(req.body);

        if (!parsedBody.success) {
            res.status(400).json({
                success: false,
                errors: parsedBody.error.flatten(),
            });
            return;
        }

        const auth = res.locals.auth as AuthContext;
        const product = await updateProductService(
            auth.userId,
            parsedId.data,
            parsedBody.data,
        );

        res.json({
            success: true,
            data: product,
        });
    } catch (error) {
        handleError(error, res, next);
    }
}

export const archiveProduct: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const parsedId = productIdSchema.safeParse(req.params.id);
        const auth = res.locals.auth as AuthContext;
        if (!parsedId.success) {
            res.status(400).json({
                success: false,
                message: "Invalid product ID",
            });
            return;
        }

        const product = await archiveProductService(
            auth.userId,
            parsedId.data,
        );

        res.json({
            success: true,
            message: "Product archived successfully",
            data: product,
        });
    } catch (error) {
        handleError(error, res, next);
    }
}
