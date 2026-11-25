import { and, desc, eq, gt } from "drizzle-orm";

import { db } from "../../infrastructure/database/client.js";

import {
    products,
    requests,
    conversations,
    messages,
    notifications,
} from "../../infrastructure/database/schema.js";

import type { CreateRequestInput } from "./requests.validation.js";

export class RequestError extends Error {
    constructor(
        message: string,
        public statusCode: number,
    ) {
        super(message);
        this.name = "RequestError";
    }
}

export const createRequest = async (
    buyerId: string,
    input: CreateRequestInput,
) => {
    try {
        return await db.transaction(async (tx) => {
            // 1. Fetch and validate the product.
            const [product] = await tx
                .select({
                    id: products.id,
                    sellerId: products.sellerId,
                    title: products.title,
                    listingType: products.listingType,
                    status: products.status,
                    stock: products.stock,
                })
                .from(products)
                .where(
                    and(
                        eq(products.id, input.productId),
                        eq(products.status, "active"),
                        gt(products.stock, 0),
                    ),
                )
                .limit(1);

            if (!product) {
                throw new RequestError(
                    "Product is unavailable",
                    404,
                );
            }

            // 2. Prevent sellers from requesting their own products.
            if (product.sellerId === buyerId) {
                throw new RequestError(
                    "You cannot request your own product",
                    400,
                );
            }

            // 3. Ensure request type matches listing type.
            const expectedType =
                product.listingType === "sale"
                    ? "purchase"
                    : product.listingType === "rent"
                        ? "rent"
                        : null;

            if (input.type !== expectedType) {
                throw new RequestError(
                    "Request type does not match the product listing",
                    400,
                );
            }

            if (!product.sellerId) {
                throw new RequestError(
                    "Unable to get the seller details",
                    400,
                );
            }

            // 4. Create the request.
            const [request] = await tx
                .insert(requests)
                .values({
                    productId: product.id,
                    buyerId,
                    sellerId: product.sellerId,
                    type: input.type,
                    status: "pending",
                })
                .returning();

            // 5. Create the conversation.
            const [conversation] = await tx
                .insert(conversations)
                .values({
                    requestId: request.id,
                    buyerId,
                    sellerId: product.sellerId,
                })
                .returning();

            // 6. Save the buyer's initial message.
            const [message] = await tx
                .insert(messages)
                .values({
                    conversationId: conversation.id,
                    senderId: buyerId,
                    body: input.message,
                })
                .returning();

            // 7. Notify the seller.
            const [notification] = await tx
                .insert(notifications)
                .values({
                    recipientId: product.sellerId,
                    actorId: buyerId,
                    type: "new_request",
                    requestId: request.id,
                    conversationId: conversation.id,
                })
                .returning();

            return {
                request,
                conversation,
                message,
                notification,
                product: {
                    id: product.id,
                    title: product.title,
                },
            };
        });
    } catch (error) {
        // if (
        //     error &&
        //     typeof error === "object" &&
        //     "code" in error &&
        //     error.code === "23505"
        // ) {
        //     throw new RequestError(
        //         "You already have an active request for this product",
        //         409,
        //     );
        // }
        throw new RequestError(
            "You already have an active request for this product",
            409,
        );

    }
};

export const getReceivedRequests = async (sellerId: string) => {
    return db
        .select({
            request: requests,
            product: {
                id: products.id,
                title: products.title,
                price: products.price,
                listingType: products.listingType,
            },
        })
        .from(requests)
        .innerJoin(
            products,
            eq(requests.productId, products.id),
        )
        .where(eq(requests.sellerId, sellerId))
        .orderBy(desc(requests.createdAt))
        .limit(50);
};

export const getSentRequests = async (buyerId: string) => {
    return db
        .select({
            request: requests,
            product: {
                id: products.id,
                title: products.title,
                price: products.price,
                listingType: products.listingType,
            },
        })
        .from(requests)
        .innerJoin(
            products,
            eq(requests.productId, products.id),
        )
        .where(eq(requests.buyerId, buyerId))
        .orderBy(desc(requests.createdAt))
        .limit(50);
};

type RequestAction = "accept" | "decline" | "cancel";

export const updateRequestStatus = async (
    requestId: string,
    userId: string,
    action: RequestAction,
) => {
    return db.transaction(async (tx) => {
        const isBuyerAction = action === "cancel";

        const ownershipCondition = isBuyerAction
            ? eq(requests.buyerId, userId)
            : eq(requests.sellerId, userId);

        // Only the correct participant can perform this action.
        const [existingRequest] = await tx
            .select()
            .from(requests)
            .where(
                and(
                    eq(requests.id, requestId),
                    ownershipCondition,
                ),
            )
            .limit(1);

        if (!existingRequest) {
            throw new RequestError(
                "Request not found",
                404,
            );
        }

        if (existingRequest.status !== "pending") {
            throw new RequestError(
                "Only pending requests can be updated",
                409,
            );
        }

        const newStatus =
            action === "accept"
                ? "accepted"
                : action === "decline"
                    ? "declined"
                    : "cancelled";

        // The pending condition protects against concurrent actions.
        const [updatedRequest] = await tx
            .update(requests)
            .set({
                status: newStatus,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(requests.id, requestId),
                    eq(requests.status, "pending"),
                    ownershipCondition,
                ),
            )
            .returning();

        if (!updatedRequest) {
            throw new RequestError(
                "This request has already been updated",
                409,
            );
        }

        // Update conversation activity timestamp.
        await tx
            .update(conversations)
            .set({
                updatedAt: new Date(),
            })
            .where(
                eq(conversations.requestId, requestId),
            );

        // Notify the other participant.
        const recipientId = isBuyerAction
            ? updatedRequest.sellerId
            : updatedRequest.buyerId;

        const notificationType =
            action === "accept"
                ? "request_accepted"
                : action === "decline"
                    ? "request_declined"
                    : "request_cancelled";

        await tx.insert(notifications).values({
            recipientId,
            actorId: userId,
            type: notificationType,
            requestId: updatedRequest.id,
        });

        return updatedRequest;
    });
};