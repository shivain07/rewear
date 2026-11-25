import type { RequestHandler } from "express";

import {
    sellerProductsQuerySchema,
    updateStockSchema,
} from "./sellers-inventory.validation.js";

import {
    getSellerDashboard,
    getSellerProducts,
    updateSellerProductStock,
} from "./sellers-inventory.service.js";

import { SellerInventoryError } from "./sellers-inventory.service.js";
import { AuthContext } from "../auth/auth.types.js";

const handleInventoryError = (
    error: unknown,
    next: Parameters<RequestHandler>[2],
) => {
    if (error instanceof SellerInventoryError) {
        next(error);
        return;
    }

    next(error);
};

export const getMyDashboard: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const auth = res.locals.auth as AuthContext;
        const sellerId = auth.userId;

        const dashboard = await getSellerDashboard(sellerId);

        res.status(200).json({
            success: true,
            data: dashboard,
        });
    } catch (error) {
        handleInventoryError(error, next);
    }
};

export const getMyProducts: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const auth = res.locals.auth as AuthContext;
        const sellerId = auth.userId;

        const filters = sellerProductsQuerySchema.parse(
            req.query,
        );

        const result = await getSellerProducts(
            sellerId,
            filters,
        );

        res.status(200).json({
            success: true,
            data: result.items,
            pagination: result.pagination,
        });
    } catch (error) {
        handleInventoryError(error, next);
    }
};

export const updateMyProductStock: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const auth = res.locals.auth as AuthContext;
        const sellerId = auth.userId;

        const productId = req.params.id as string;

        const parsed = updateStockSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                success: false,
                message: "Invalid stock update",
                errors: parsed.error.flatten().fieldErrors,
            });
            return;
        }

        const product = await updateSellerProductStock(
            sellerId,
            productId,
            parsed.data,
        );

        res.status(200).json({
            success: true,
            message: "Product stock updated successfully",
            data: product,
        });
    } catch (error) {
        handleInventoryError(error, next);
    }
};