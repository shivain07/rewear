import type { RequestHandler } from "express";

import { createRequestSchema } from "./requests.validation.js";
import {
    createRequest as createRequestService,
    RequestError,
    getReceivedRequests,
    getSentRequests,
    updateRequestStatus,
} from "./requests.service.js";
import { AuthContext } from "../auth/auth.types.js";

export const createBuyerRequest: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const auth = res.locals.auth as AuthContext;
        const parsedBody = createRequestSchema.safeParse(
            req.body,
        );

        if (!parsedBody.success) {
            res.status(400).json({
                success: false,
                message: "Invalid request",
            });
            return;
        }

        const buyerId = auth.userId;

        const input = parsedBody.data;

        const result = await createRequestService(
            buyerId,
            input,
        );

        res.status(201).json({
            success: true,
            message: "Request sent successfully",
            data: result,
        });
    } catch (error) {
        if (error instanceof RequestError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message,
            });
            return;
        }

        next(error);
    }
};

export const getMyReceivedRequests: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const auth = res.locals.auth as AuthContext;
        const sellerId = auth.userId;

        const result = await getReceivedRequests(sellerId);

        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

export const getMySentRequests: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const auth = res.locals.auth as AuthContext;
        const buyerId = auth.userId;

        const result = await getSentRequests(buyerId);

        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

export const acceptRequest: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const auth = res.locals.auth as AuthContext;
        const userId = auth.userId;

        const result = await updateRequestStatus(
            req.params.id as string,
            userId,
            "accept",
        );

        res.status(200).json({
            success: true,
            message: "Request accepted successfully",
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

export const declineRequest: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const auth = res.locals.auth as AuthContext;
        const userId = auth.userId;

        const result = await updateRequestStatus(
            req.params.id as string,
            userId,
            "decline",
        );

        res.status(200).json({
            success: true,
            message: "Request declined successfully",
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

export const cancelRequest: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const auth = res.locals.auth as AuthContext;
        const userId = auth.userId;

        const result = await updateRequestStatus(
            req.params.id as string,
            userId,
            "cancel",
        );

        res.status(200).json({
            success: true,
            message: "Request cancelled successfully",
            data: result,
        });
    } catch (error) {
        next(error);
    }
};