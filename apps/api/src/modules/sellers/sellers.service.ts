
import { eq } from "drizzle-orm";

import { db } from "../../infrastructure/database/client.js";

import {
    users,
    sellerProfiles,
} from "../../infrastructure/database/schema.js";

import type {
    CreateSellerProfileInput,
    UpdateSellerProfileInput,
} from "./sellers.validation.js";

export class SellerError extends Error {
    constructor(
        public code:
            | "NOT_FOUND"
            | "NOT_SELLER"
            | "PROFILE_EXISTS"
            | "PROFILE_MISSING"
            | "SHOP_NAME_TAKEN",
        message: string,
    ) {
        super(message);
        this.name = "SellerError";
    }
}

// --------------------------------------------------
// CREATE SELLER PROFILE
// --------------------------------------------------

export async function createSellerProfile(
    userId: string,
    input: CreateSellerProfileInput,
) {
    const [user] = await db
        .select({
            id: users.id,
            role: users.role,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    if (!user) {
        throw new SellerError(
            "NOT_FOUND",
            "User not found",
        );
    }

    if (user.role !== "seller") {
        throw new SellerError(
            "NOT_SELLER",
            "Only sellers can create seller profiles",
        );
    }

    const [existingProfile] = await db
        .select({
            userId: sellerProfiles.userId,
        })
        .from(sellerProfiles)
        .where(eq(sellerProfiles.userId, userId))
        .limit(1);

    if (existingProfile) {
        throw new SellerError(
            "PROFILE_EXISTS",
            "Seller profile already exists",
        );
    }

    const [profile] = await db
        .insert(sellerProfiles)
        .values({
            userId,
            shopName: input.shopName,
            bio: input.bio ?? null,
            location: input.location ?? null,
        })
        .returning();

    return profile;
}

// --------------------------------------------------
// GET OWN SELLER PROFILE
// --------------------------------------------------

export async function getMySellerProfile(userId: string) {
    const [profile] = await db
        .select()
        .from(sellerProfiles)
        .where(eq(sellerProfiles.userId, userId))
        .limit(1);

    if (!profile) {
        throw new SellerError(
            "PROFILE_MISSING",
            "Seller profile not found",
        );
    }

    return profile;
}

// --------------------------------------------------
// GET PUBLIC SELLER PROFILE
// --------------------------------------------------

export async function getPublicSellerProfile(userId: string) {
    const [profile] = await db
        .select({
            userId: sellerProfiles.userId,
            name: users.name,
            shopName: sellerProfiles.shopName,
            bio: sellerProfiles.bio,
            location: sellerProfiles.location,
            createdAt: sellerProfiles.createdAt,
        })
        .from(sellerProfiles)
        .innerJoin(
            users,
            eq(sellerProfiles.userId, users.id),
        )
        .where(eq(sellerProfiles.userId, userId))
        .limit(1);

    if (!profile) {
        throw new SellerError(
            "PROFILE_MISSING",
            "Seller profile not found",
        );
    }

    return profile;
}

// --------------------------------------------------
// UPDATE SELLER PROFILE
// --------------------------------------------------

export async function updateSellerProfile(
    userId: string,
    input: UpdateSellerProfileInput,
) {
    const [existingProfile] = await db
        .select()
        .from(sellerProfiles)
        .where(eq(sellerProfiles.userId, userId))
        .limit(1);

    if (!existingProfile) {
        throw new SellerError(
            "PROFILE_MISSING",
            "Seller profile not found",
        );
    }

    const [updatedProfile] = await db
        .update(sellerProfiles)
        .set({
            ...input,
            updatedAt: new Date(),
        })
        .where(eq(sellerProfiles.userId, userId))
        .returning();

    return updatedProfile;
}
