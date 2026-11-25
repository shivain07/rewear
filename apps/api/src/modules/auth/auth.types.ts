import type { users } from "../../infrastructure/database/schema.js";

export type User = typeof users.$inferSelect;

export type AuthUser = Pick<
    User,
    "id" | "name" | "email" | "role" | "createdAt"
>;

export type AuthContext = {
    userId: string;
    role: User["role"];
};

export function toAuthUser(user: User): AuthUser {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
    };
}