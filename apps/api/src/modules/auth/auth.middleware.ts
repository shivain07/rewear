import type { RequestHandler } from "express";
import { verifyAccessToken } from "./auth.utils.js";
import type { AuthContext } from "./auth.types.js";

export const authenticate: RequestHandler = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
        res.status(401).json({
            success: false,
            message: "Authentication required",
        });
        return;
    }

    const token = authorization.slice("Bearer ".length);

    try {
        const payload = verifyAccessToken(token);

        res.locals.auth = {
            userId: payload.sub as string,
            role: payload.role as AuthContext["role"],
        } satisfies AuthContext;

        next();
    } catch {
        res.status(401).json({
            success: false,
            message: "Invalid or expired access token",
        });
    }
};

export function requireRole(
    ...allowedRoles: AuthContext["role"][]
): RequestHandler {
    return (_req, res, next) => {
        const auth = res.locals.auth as AuthContext | undefined;

        if (!auth || !allowedRoles.includes(auth.role)) {
            res.status(403).json({
                success: false,
                message: "You do not have permission to perform this action",
            });
            return;
        }

        next();
    };
}