import {
    and,
    count,
    desc,
    eq,
    isNull,
    ne,
    or,
    sql,
} from "drizzle-orm";

import { db } from "../../infrastructure/database/client.js";

import {
    products,
    requests,
    conversations,
    messages,
    notifications,
} from "../../infrastructure/database/schema.js";


export class RequestError extends Error {
    constructor(
        message: string,
        public statusCode: number,
    ) {
        super(message);
        this.name = "RequestError";
    }
}

const getConversationForParticipant = async (
    conversationId: string,
    userId: string,
) => {
    const [conversation] = await db
        .select({
            id: conversations.id,
            buyerId: conversations.buyerId,
            sellerId: conversations.sellerId,
            requestId: conversations.requestId,
            requestStatus: requests.status,
        })
        .from(conversations)
        .innerJoin(
            requests,
            eq(conversations.requestId, requests.id),
        )
        .where(
            and(
                eq(conversations.id, conversationId),
                or(
                    eq(conversations.buyerId, userId),
                    eq(conversations.sellerId, userId),
                ),
            ),
        )
        .limit(1);

    if (!conversation) {
        throw new RequestError("Conversation not found", 404);
    }

    return conversation;
};

export const getConversationMessages = async (
    conversationId: string,
    userId: string,
    limit: number,
    before?: string,
) => {
    await getConversationForParticipant(conversationId, userId);

    let cursorMessage:
        | { id: string; createdAt: Date }
        | undefined;

    if (before) {
        const [cursor] = await db
            .select({
                id: messages.id,
                createdAt: messages.createdAt,
            })
            .from(messages)
            .where(
                and(
                    eq(messages.id, before),
                    eq(messages.conversationId, conversationId),
                ),
            )
            .limit(1);

        if (!cursor) {
            throw new RequestError("Invalid message cursor", 400);
        }

        cursorMessage = cursor;
    }

    const conditions = [
        eq(messages.conversationId, conversationId),
    ];

    if (cursorMessage) {
        conditions.push(
            or(
                sql`${messages.createdAt} < ${cursorMessage.createdAt}`,
                and(
                    eq(messages.createdAt, cursorMessage.createdAt),
                    sql`${messages.id} < ${cursorMessage.id}`,
                ),
            )!,
        );
    }

    const rows = await db
        .select()
        .from(messages)
        .where(and(...conditions))
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);

    // API returns chronological order for easier chat rendering.
    const chronologicalMessages = page.reverse();

    return {
        messages: chronologicalMessages,
        hasMore,
        nextCursor: hasMore
            ? chronologicalMessages[0]?.id ?? null
            : null,
    };
};


export const sendConversationMessage = async (
    conversationId: string,
    senderId: string,
    body: string,
) => {
    return db.transaction(async (tx) => {
        const [conversation] = await tx
            .select({
                id: conversations.id,
                buyerId: conversations.buyerId,
                sellerId: conversations.sellerId,
                requestId: conversations.requestId,
                requestStatus: requests.status,
            })
            .from(conversations)
            .innerJoin(
                requests,
                eq(conversations.requestId, requests.id),
            )
            .where(
                and(
                    eq(conversations.id, conversationId),
                    or(
                        eq(conversations.buyerId, senderId),
                        eq(conversations.sellerId, senderId),
                    ),
                ),
            )
            .limit(1);

        if (!conversation) {
            throw new RequestError("Conversation not found", 404);
        }

        if (
            conversation.requestStatus !== "pending" &&
            conversation.requestStatus !== "accepted"
        ) {
            throw new RequestError(
                "Messaging is closed for this request",
                409,
            );
        }

        const recipientId =
            conversation.buyerId === senderId
                ? conversation.sellerId
                : conversation.buyerId;

        const [message] = await tx
            .insert(messages)
            .values({
                conversationId,
                senderId,
                body,
            })
            .returning();

        await tx
            .update(conversations)
            .set({
                updatedAt: new Date(),
            })
            .where(eq(conversations.id, conversationId));

        await tx.insert(notifications).values({
            recipientId,
            actorId: senderId,
            type: "new_message",
            requestId: conversation.requestId,
            conversationId,
        });

        return message;
    });
};

export const markConversationAsRead = async (
    conversationId: string,
    userId: string,
) => {
    await getConversationForParticipant(conversationId, userId);

    const result = await db
        .update(messages)
        .set({
            readAt: new Date(),
        })
        .where(
            and(
                eq(messages.conversationId, conversationId),
                ne(messages.senderId, userId),
                isNull(messages.readAt),
            ),
        )
        .returning({
            id: messages.id,
        });

    return {
        markedAsRead: result.length,
    };
};

export const getMyConversations = async (userId: string) => {

    const lastMessageIdSubQuery = db
        .select({ id: messages.id })
        .from(messages)
        .where(eq(messages.conversationId, conversations.id))
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .limit(1)
        .as("lastMessageId");

    const lastMessageBodySubQuery = db
        .select({ body: messages.body })
        .from(messages)
        .where(eq(messages.conversationId, conversations.id))
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .limit(1)
        .as("lastMessageBody");

    const lastMessageSenderIdSubQuery = db
        .select({ senderId: messages.senderId })
        .from(messages)
        .where(eq(messages.conversationId, conversations.id))
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .limit(1)
        .as("lastMessageSenderId");

    const lastMessageAtSubQuery = db
        .select({ createdAt: messages.createdAt })
        .from(messages)
        .where(eq(messages.conversationId, conversations.id))
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .limit(1)
        .as("lastMessageAt");

    const unreadCountSubQuery = db
        .select({ value: count() })
        .from(messages)
        .where(and(eq(messages.conversationId, conversations.id), ne(messages.senderId, userId), isNull(messages.readAt)))
        .as("unreadCount");

    const rows = await db
        .select({
            id: conversations.id,
            requestId: requests.id,
            productId: products.id,
            productTitle: products.title,
            productPrice: products.price,
            requestType: requests.type,
            requestStatus: requests.status,
            buyerId: conversations.buyerId,
            sellerId: conversations.sellerId,
            updatedAt: conversations.updatedAt,

            lastMessageId:sql`${lastMessageIdSubQuery}`,

            lastMessageBody: sql`${lastMessageBodySubQuery}`,

            lastMessageSenderId: sql`${lastMessageSenderIdSubQuery}`,

            lastMessageAt:sql`${lastMessageAtSubQuery}`,

            unreadCount: sql`${unreadCountSubQuery}`,
        })
        .from(conversations)
        .innerJoin(
            requests,
            eq(conversations.requestId, requests.id),
        )
        .innerJoin(
            products,
            eq(requests.productId, products.id),
        )
        .where(
            or(
                eq(conversations.buyerId, userId),
                eq(conversations.sellerId, userId),
            ),
        )
        .orderBy(desc(conversations.updatedAt))
        .limit(50);

    return rows.map((row) => ({
        ...row,
        isBuyer: row.buyerId === userId,
        otherParticipantId:
            row.buyerId === userId ? row.sellerId : row.buyerId,
    }));
};