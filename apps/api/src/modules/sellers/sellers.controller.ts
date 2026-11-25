import type { RequestHandler } from "express";

import type { AuthContext } from "../auth/auth.types.js";

import {
    SellerError,
    createSellerProfile,
    getMySellerProfile,
    getPublicSellerProfile,
    updateSellerProfile,
} from "./sellers.service.js";

import {
    createSellerProfileSchema,
    updateSellerProfileSchema,
} from "./sellers.validation.js";

const sellerErrorStatus: Record<SellerError["code"], number> = {
    NOT_FOUND: 404,
    PROFILE_MISSING: 404,
    PROFILE_EXISTS: 409,
    SHOP_NAME_TAKEN: 409,
    NOT_SELLER: 403,
};

function sendSellerError(
    error: unknown,
    res: Parameters<RequestHandler>[1],
    next: Parameters<RequestHandler>[2],
) {
    if (error instanceof SellerError) {
        res.status(sellerErrorStatus[error.code]).json({
            success: false,
            message: error.message,
        });
        return;
    }

    next(error);
}

export const createProfile: RequestHandler = async (req, res, next) => {
    try {
        const parsed = createSellerProfileSchema.safeParse(req.body);

        if (!parsed.success) {
            res.status(400).json({
                success: false,
                message: "Invalid seller profile",
                errors: parsed.error.flatten().fieldErrors,
            });
            return;
        }

        const auth = res.locals.auth as AuthContext;

        const profile = await createSellerProfile(
            auth.userId,
            parsed.data,
        );

        res.status(201).json({
            success: true,
            data: profile,
        });
    } catch (error) {
        sendSellerError(error, res, next);
    }
};

export const getMyProfile: RequestHandler = async (_req, res, next) => {
    try {
        const auth = res.locals.auth as AuthContext;

        const profile = await getMySellerProfile(
            auth.userId,
        );

        res.json({
            success: true,
            data: profile,
        });
    } catch (error) {
        sendSellerError(error, res, next);
    }
};

export const updateProfile: RequestHandler = async (req, res, next) => {
    try {
        const parsed = updateSellerProfileSchema.safeParse(req.body);

        if (!parsed.success) {
            res.status(400).json({
                success: false,
                message: "Invalid seller profile",
                errors: parsed.error.flatten().fieldErrors,
            });
            return;
        }

        const auth = res.locals.auth as AuthContext;

        const profile = await updateSellerProfile(
            auth.userId,
            parsed.data,
        );

        res.json({
            success: true,
            data: profile,
        });
    } catch (error) {
        sendSellerError(error, res, next);
    }
};

export const getPublicProfile: RequestHandler = async (req, res, next) => {
    try {
        const sellerId = req.params.id;

        if (typeof sellerId !== "string") {
            res.status(400).json({
                success: false,
                message: "Invalid seller id",
            });
            return;
        }

        const profile = await getPublicSellerProfile(sellerId);

        res.json({
            success: true,
            data: profile,
        });
    } catch (error) {
        sendSellerError(error, res, next);
    }
};
