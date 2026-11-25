import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { User } from "./auth.types.js";

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;

if (!JWT_ACCESS_SECRET) {
    throw new Error("JWT_ACCESS_SECRET is missing");
}

const ACCESS_TOKEN_TTL =
    (process.env.JWT_ACCESS_TTL || "15m") as jwt.SignOptions["expiresIn"];

const REFRESH_TOKEN_TTL_DAYS = Number(
    process.env.REFRESH_TOKEN_TTL_DAYS || 7,
);

export function hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateRefreshToken(): string {
    return crypto.randomBytes(48).toString("base64url");
}

export function getRefreshTokenExpiry(): Date {
    const expiry = new Date();

    expiry.setDate(expiry.getDate() + REFRESH_TOKEN_TTL_DAYS);

    return expiry;
}

export function generateAccessToken(user: User): string {
    return jwt.sign(
        {
            sub: user.id,
            role: user.role,
        },
        JWT_ACCESS_SECRET!,
        {
            expiresIn: ACCESS_TOKEN_TTL,
            issuer: "rewear-api",
            audience: "rewear-client",
        },
    );
}

export function verifyAccessToken(token: string): jwt.JwtPayload {
    const payload = jwt.verify(token, JWT_ACCESS_SECRET!, {
        issuer: "rewear-api",
        audience: "rewear-client",
    });

    if (typeof payload === "string" || !payload.sub) {
        throw new Error("Invalid access token");
    }

    return payload;
}