import type { NextFunction, RequestHandler, Response } from "express";

import {
    conversationIdSchema,
    getMessagesQuerySchema,
    sendMessageSchema,
} from "./conversation.validation.js";

import {
    getConversationMessages,
    getMyConversations,
    markConversationAsRead,
    RequestError,
    sendConversationMessage,
} from "./conversations.service.js";
import { AuthContext } from "../auth/auth.types.js";

function handleConversationError(
    error: unknown,
    res: Response,
    next: NextFunction,
) {
    if (error instanceof RequestError) {
        res.status(error.statusCode).json({
            success: false,
            message: error.message,
        });
        return;
    }

    next(error);
}

export const getMyConversationsController: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const auth = res.locals.auth as AuthContext;
        const conversations = await getMyConversations(
            auth.userId,
        );

        res.status(200).json({
            success: true,
            data: conversations,
        });
    } catch (error) {
        handleConversationError(error, res, next);
    }
};

export const getConversationMessagesController: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const params = conversationIdSchema.safeParse(req.params);
        const query = getMessagesQuerySchema.safeParse(req.query);

        if (!params.success || !query.success) {
            res.status(400).json({
                success: false,
                message: "Invalid request parameters",
                errors: {
                    params: params.success ? undefined : params.error.flatten(),
                    query: query.success ? undefined : query.error.flatten(),
                },
            });
            return;
        }

        const auth = res.locals.auth as AuthContext;
        const result = await getConversationMessages(
            params.data.id,
            auth.userId,
            query.data.limit,
            query.data.before,
        );

        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        handleConversationError(error, res, next);
    }
};

export const sendConversationMessageController: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const params = conversationIdSchema.safeParse(req.params);
        const body = sendMessageSchema.safeParse(req.body);

        if (!params.success || !body.success) {
            res.status(400).json({
                success: false,
                message: "Invalid request parameters",
                errors: {
                    params: params.success ? undefined : params.error.flatten(),
                    body: body.success ? undefined : body.error.flatten(),
                },
            });
            return;
        }

        const auth = res.locals.auth as AuthContext;
        const message = await sendConversationMessage(
            params.data.id,
            auth.userId,
            body.data.body,
        );

        res.status(201).json({
            success: true,
            data: message,
        });
    } catch (error) {
        handleConversationError(error, res, next);
    }
};

export const markConversationAsReadController: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const params = conversationIdSchema.safeParse(req.params);

        if (!params.success) {
            res.status(400).json({
                success: false,
                message: "Invalid conversation ID",
            });
            return;
        }

        const auth = res.locals.auth as AuthContext;
        const result = await markConversationAsRead(
            params.data.id,
            auth.userId,
        );

        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        handleConversationError(error, res, next);
    }
};