import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "../../infrastructure/database/client.js";
import {
    users,
    refreshSessions,
} from "../../infrastructure/database/schema.js";

import {
    generateAccessToken,
    generateRefreshToken,
    getRefreshTokenExpiry,
    hashToken,
} from "./auth.utils.js";

import { toAuthUser } from "./auth.types.js";
import type { AuthContext } from "./auth.types.js";
import { authenticate } from "./auth.middleware.js";

const router = Router();

const COOKIE_NAME = "rewear_refresh_token";

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/auth",
};

const registerSchema = z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(255),
    password: z.string().min(8).max(72),
});

const loginSchema = z.object({
    email: z.string().trim().email().max(255),
    password: z.string().min(1).max(72),
});

function setRefreshCookie(res: Response, token: string) {
    const expires = getRefreshTokenExpiry();

    res.cookie(COOKIE_NAME, token, {
        ...cookieOptions,
        expires,
    });
}

function clearRefreshCookie(res: Response) {
    res.clearCookie(COOKIE_NAME, cookieOptions);
}

async function createRefreshSession(userId: string) {
    const refreshToken = generateRefreshToken();

    await db.insert(refreshSessions).values({
        userId,
        tokenHash: hashToken(refreshToken),
        expiresAt: getRefreshTokenExpiry(),
    });

    return refreshToken;
}

// POST /api/auth/register
router.post("/register", async (req, res, next) => {
    try {
        const parsed = registerSchema.safeParse(req.body);

        if (!parsed.success) {
            res.status(400).json({
                success: false,
                message: "Invalid registration details",
                errors: parsed.error.flatten().fieldErrors,
            });
            return;
        }

        const name = parsed.data.name;
        const email = parsed.data.email.toLowerCase();
        const password = parsed.data.password;

        const existingUser = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

        if (existingUser.length > 0) {
            res.status(409).json({
                success: false,
                message: "An account with this email already exists",
            });
            return;
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const [user] = await db
            .insert(users)
            .values({
                name,
                email,
                passwordHash,
                role: "buyer",
            })
            .returning();

        const refreshToken = await createRefreshSession(user.id); // crypto hash
        const accessToken = generateAccessToken(user); // jwt

        setRefreshCookie(res, refreshToken);

        res.status(201).json({
            success: true,
            data: {
                user: toAuthUser(user),
                accessToken,
            },
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/login
router.post("/login", async (req, res, next) => {
    try {
        const parsed = loginSchema.safeParse(req.body);

        if (!parsed.success) {
            res.status(400).json({
                success: false,
                message: "Invalid login details",
            });
            return;
        }

        const email = parsed.data.email.toLowerCase();

        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

        if (!user) {
            res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
            return;
        }

        const passwordMatches = await bcrypt.compare(
            parsed.data.password,
            user.passwordHash,
        );

        if (!passwordMatches) {
            res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
            return;
        }

        const refreshToken = await createRefreshSession(user.id);
        const accessToken = generateAccessToken(user);

        setRefreshCookie(res, refreshToken);

        res.json({
            success: true,
            data: {
                user: toAuthUser(user),
                accessToken,
            },
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/refresh
router.post("/refresh", async (req, res, next) => {
    try {
        const oldToken = req.cookies?.[COOKIE_NAME];

        if (!oldToken || typeof oldToken !== "string") {
            res.status(401).json({
                success: false,
                message: "Refresh token missing",
            });
            return;
        }

        const oldTokenHash = hashToken(oldToken);

        const result = await db.transaction(async (tx) => {
            const [session] = await tx
                .select()
                .from(refreshSessions)
                .where(eq(refreshSessions.tokenHash, oldTokenHash))
                .for("update");

            if (!session) {
                return { status: "invalid" as const };
            }

            // A revoked token being reused may indicate token theft.
            if (session.revokedAt) {
                await tx
                    .update(refreshSessions)
                    .set({ revokedAt: new Date() })
                    .where(eq(refreshSessions.userId, session.userId));

                return { status: "reuse" as const };
            }

            if (session.expiresAt <= new Date()) {
                await tx
                    .update(refreshSessions)
                    .set({ revokedAt: new Date() })
                    .where(eq(refreshSessions.id, session.id));

                return { status: "expired" as const };
            }

            const [user] = await tx
                .select()
                .from(users)
                .where(eq(users.id, session.userId))
                .limit(1);

            if (!user) {
                return { status: "invalid" as const };
            }

            const newRefreshToken = generateRefreshToken();

            await tx
                .update(refreshSessions)
                .set({ revokedAt: new Date() })
                .where(eq(refreshSessions.id, session.id));

            await tx.insert(refreshSessions).values({
                userId: user.id,
                tokenHash: hashToken(newRefreshToken),
                expiresAt: getRefreshTokenExpiry(),
            });

            return {
                status: "success" as const,
                user,
                newRefreshToken,
            };
        });

        if (result.status !== "success") {
            clearRefreshCookie(res);

            res.status(401).json({
                success: false,
                message:
                    result.status === "reuse"
                        ? "Refresh token reuse detected. Please log in again."
                        : "Refresh session is invalid. Please log in again.",
            });
            return;
        }

        setRefreshCookie(res, result.newRefreshToken);

        res.json({
            success: true,
            data: {
                user: toAuthUser(result.user),
                accessToken: generateAccessToken(result.user),
            },
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/logout
router.post("/logout", async (req, res, next) => {
    try {
        const refreshToken = req.cookies?.[COOKIE_NAME];

        if (typeof refreshToken === "string") {
            await db
                .update(refreshSessions)
                .set({ revokedAt: new Date() })
                .where(
                    eq(refreshSessions.tokenHash, hashToken(refreshToken)),
                );
        }

        clearRefreshCookie(res);

        res.json({
            success: true,
            message: "Logged out successfully",
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/auth/me
router.get("/me", authenticate, async (req, res, next) => {
    try {
        const auth = res.locals.auth as AuthContext;

        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, auth.userId))
            .limit(1);

        if (!user) {
            res.status(404).json({
                success: false,
                message: "User not found",
            });
            return;
        }

        res.json({
            success: true,
            data: toAuthUser(user),
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/become-seller
router.post("/become-seller", authenticate, async (_req, res, next) => {
    try {
        const auth = res.locals.auth as AuthContext;

        const [user] = await db
            .update(users)
            .set({
                role: "seller",
                updatedAt: new Date(),
            })
            .where(eq(users.id, auth.userId))
            .returning();

        if (!user) {
            res.status(404).json({
                success: false,
                message: "User not found",
            });
            return;
        }

        res.json({
            success: true,
            data: {
                user: toAuthUser(user),
                accessToken: generateAccessToken(user)
            },
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/become-buyer
router.post("/become-buyer", authenticate, async (_req, res, next) => {
    try {
        const auth = res.locals.auth as AuthContext;

        const [user] = await db
            .update(users)
            .set({
                role: "buyer",
                updatedAt: new Date(),
            })
            .where(eq(users.id, auth.userId))
            .returning();

        if (!user) {
            res.status(404).json({
                success: false,
                message: "User not found",
            });
            return;
        }

        res.json({
            success: true,
            data: {
                user: toAuthUser(user),
                accessToken: generateAccessToken(user),
            },
        });
    } catch (error) {
        next(error);
    }
});

export default router;