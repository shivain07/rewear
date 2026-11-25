import {
    pgTable,
    uuid,
    varchar,
    text,
    numeric,
    timestamp,
    integer,
    pgEnum,
    uniqueIndex,
    index,

} from "drizzle-orm/pg-core";

import { sql } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", [
    "buyer",
    "seller",
    "admin",
]);

export const listingTypeEnum = pgEnum("listing_type", [
    "sale",
    "rent",
]);

export const productConditionEnum = pgEnum("product_condition", [
    "new",
    "like_new",
    "good",
    "fair",
]);

export const requestTypeEnum = pgEnum(
    "request_type",
    ["purchase", "rent"],
);

export const requestStatusEnum = pgEnum(
    "request_status",
    [
        "pending",
        "accepted",
        "declined",
        "cancelled",
        "closed",
    ],
);

export const notificationTypeEnum = pgEnum(
    "notification_type",
    [
        "new_request",
        "request_accepted",
        "request_declined",
        "request_cancelled",
        "new_message",
    ],
);

export const users = pgTable(
    "users",
    {
        id: uuid("id").defaultRandom().primaryKey(),

        name: varchar("name", { length: 100 }).notNull(),

        email: varchar("email", { length: 255 }).notNull(),

        passwordHash: text("password_hash").notNull(),

        role: userRoleEnum("role").notNull().default("buyer"),

        createdAt: timestamp("created_at", {
            withTimezone: true,
        }).notNull().defaultNow(),

        updatedAt: timestamp("updated_at", {
            withTimezone: true,
        }).notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("users_email_unique").on(table.email),
    ],
);

export const refreshSessions = pgTable(
    "refresh_sessions",
    {
        id: uuid("id").defaultRandom().primaryKey(),

        userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

        tokenHash: varchar("token_hash", { length: 64 }).notNull(),

        expiresAt: timestamp("expires_at", {
            withTimezone: true,
        }).notNull(),

        revokedAt: timestamp("revoked_at", {
            withTimezone: true,
        }),

        createdAt: timestamp("created_at", {
            withTimezone: true,
        }).notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("refresh_sessions_token_hash_unique").on(
            table.tokenHash,
        ),
        index("refresh_sessions_user_id_idx").on(table.userId),
    ],
);

export const sellerProfiles = pgTable(
    "seller_profiles",
    {
        userId: uuid("user_id")
            .primaryKey()
            .references(() => users.id, {
                onDelete: "cascade",
            }),

        shopName: varchar("shop_name", {
            length: 100,
        }).notNull(),

        bio: text("bio"),

        location: varchar("location", {
            length: 150,
        }),

        createdAt: timestamp("created_at", {
            withTimezone: true,
        }).notNull().defaultNow(),

        updatedAt: timestamp("updated_at", {
            withTimezone: true,
        }).notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("seller_profiles_shop_name_unique")
            .on(table.shopName),
    ],
);

// export const productStatusEnum = pgEnum("product_status", ["active", "draft", "archived", "out_of_stock"]);
export const products = pgTable(
    "products",
    {
        id: uuid("id").defaultRandom().primaryKey(),

        // Nullable temporarily for compatibility with
        // existing products created before seller support.
        sellerId: uuid("seller_id")
            .references(() => users.id, {
                onDelete: "restrict",
            }),

        title: varchar("title", {
            length: 200,
        }).notNull(),

        description: text("description"),

        // Whole rupees only: 20, 30, 1299, etc.
        price: integer("price").notNull(),

        stock: integer("stock").notNull().default(1),

        category: varchar("category", {
            length: 80,
        }),

        size: varchar("size", {
            length: 30,
        }),

        condition: productConditionEnum("condition"),

        listingType: listingTypeEnum("listing_type"),

        // Keeping your existing status column and default.
        status: varchar("status", { length: 20 })
            .notNull()
            .default("active"),

        createdAt: timestamp("created_at", {
            withTimezone: true,
        }).notNull().defaultNow(),

        updatedAt: timestamp("updated_at", {
            withTimezone: true,
        }).notNull().defaultNow(),
    },
    (table) => [
        index("products_seller_id_idx")
            .on(table.sellerId),

        index("products_category_idx")
            .on(table.category),

        index("products_status_created_at_idx")
            .on(table.status, table.createdAt, table.id),
    ],
);



export const productImages = pgTable(
    "product_images",
    {
        id: uuid("id").defaultRandom().primaryKey(),

        productId: uuid("product_id")
            .notNull()
            .references(() => products.id, {
                onDelete: "cascade",
            }),

        imageKitFileId: varchar("imagekit_file_id", {
            length: 255,
        }),

        imageUrl: varchar("image_url", {
            length: 2048,
        }).notNull(),

        altText: text("alt_text"),

        position: integer("position").notNull().default(0),

        createdAt: timestamp("created_at", {
            withTimezone: true,
        }).notNull().defaultNow(),
    },
    (table) => [
        index("product_images_product_id_idx").on(
            table.productId,
        ),

        uniqueIndex("product_images_imagekit_file_id_unique").on(
            table.imageKitFileId,
        ),
    ],
);

export const requests = pgTable(
    "requests",
    {
        id: uuid("id").defaultRandom().primaryKey(),

        productId: uuid("product_id")
            .notNull()
            .references(() => products.id, {
                onDelete: "restrict",
            }),

        buyerId: uuid("buyer_id")
            .notNull()
            .references(() => users.id, {
                onDelete: "restrict",
            }),

        sellerId: uuid("seller_id")
            .notNull()
            .references(() => users.id, {
                onDelete: "restrict",
            }),

        type: requestTypeEnum("type").notNull(),

        status: requestStatusEnum("status")
            .notNull()
            .default("pending"),

        createdAt: timestamp("created_at", {
            withTimezone: true,
        }).notNull().defaultNow(),

        updatedAt: timestamp("updated_at", {
            withTimezone: true,
        }).notNull().defaultNow(),
    },
    (table) => [
        index("requests_buyer_id_idx").on(table.buyerId),
        index("requests_seller_id_idx").on(table.sellerId),
        index("requests_product_id_idx").on(table.productId),
        index("requests_seller_status_created_idx").on(
            table.sellerId,
            table.status,
            table.createdAt,
        ),
        uniqueIndex("requests_one_active_per_buyer_product")
            .on(table.buyerId, table.productId)
            .where(
                sql`${table.status} in ('pending', 'accepted')`,
            ),
    ],
);


export const conversations = pgTable(
    "conversations",
    {
        id: uuid("id").defaultRandom().primaryKey(),

        requestId: uuid("request_id")
            .notNull()
            .references(() => requests.id, {
                onDelete: "cascade",
            })
            .unique(),

        buyerId: uuid("buyer_id")
            .notNull()
            .references(() => users.id, {
                onDelete: "restrict",
            }),

        sellerId: uuid("seller_id")
            .notNull()
            .references(() => users.id, {
                onDelete: "restrict",
            }),

        createdAt: timestamp("created_at", {
            withTimezone: true,
        }).notNull().defaultNow(),

        updatedAt: timestamp("updated_at", {
            withTimezone: true,
        }).notNull().defaultNow(),
    },
    (table) => [
        index("conversations_buyer_id_idx").on(table.buyerId),
        index("conversations_seller_id_idx").on(table.sellerId),
    ],
);


export const messages = pgTable(
    "messages",
    {
        id: uuid("id").defaultRandom().primaryKey(),

        conversationId: uuid("conversation_id")
            .notNull()
            .references(() => conversations.id, {
                onDelete: "cascade",
            }),

        senderId: uuid("sender_id")
            .notNull()
            .references(() => users.id, {
                onDelete: "restrict",
            }),

        body: text("body").notNull(),

        readAt: timestamp("read_at", {
            withTimezone: true,
        }),

        createdAt: timestamp("created_at", {
            withTimezone: true,
        }).notNull().defaultNow(),
    },
    (table) => [
        index("messages_conversation_created_idx").on(
            table.conversationId,
            table.createdAt,
        ),
        index("messages_sender_id_idx").on(table.senderId),
    ],
);

export const notifications = pgTable(
    "notifications",
    {
        id: uuid("id").defaultRandom().primaryKey(),

        recipientId: uuid("recipient_id")
            .notNull()
            .references(() => users.id, {
                onDelete: "cascade",
            }),

        actorId: uuid("actor_id")
            .references(() => users.id, {
                onDelete: "set null",
            }),

        type: notificationTypeEnum("type").notNull(),

        requestId: uuid("request_id")
            .references(() => requests.id, {
                onDelete: "set null",
            }),

        conversationId: uuid("conversation_id")
            .references(() => conversations.id, {
                onDelete: "set null",
            }),

        readAt: timestamp("read_at", {
            withTimezone: true,
        }),

        createdAt: timestamp("created_at", {
            withTimezone: true,
        }).notNull().defaultNow(),
    },
    (table) => [
        index("notifications_recipient_created_idx").on(
            table.recipientId,
            table.createdAt,
        ),
        index("notifications_recipient_unread_idx").on(
            table.recipientId,
            table.readAt,
        ),
    ],
);