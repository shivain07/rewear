
import { Router } from "express";

import {
    authenticate,
    requireRole,
} from "../auth/auth.middleware.js";

import {
    createProfile,
    getMyProfile,
    getPublicProfile,
    updateProfile,
} from "./sellers.controller.js";

import {
    getMyDashboard,
    getMyProducts,
    updateMyProductStock,
} from "./sellers-inventory.controller.js";

const router = Router();

// Create a seller profile.
router.post(
    "/profile",
    authenticate,
    requireRole("seller"),
    createProfile,
);

// IMPORTANT: Register /me before /:id.
// get seller profile by the same user
router.get(
    "/me",
    authenticate,
    requireRole("seller"),
    getMyProfile,
);

// Update own seller profile.
router.patch(
    "/me",
    authenticate,
    requireRole("seller"),
    updateProfile,
);



router.get(
    "/me/dashboard",
    authenticate,
    requireRole("seller"),
    getMyDashboard,
);

router.get(
    "/me/products",
    authenticate,
    requireRole("seller"),
    getMyProducts,
);

router.patch(
    "/me/products/:id/stock",
    authenticate,
    requireRole("seller"),
    updateMyProductStock,
);

// Public seller profile.
router.get(
    "/:id",
    getPublicProfile,
);
export default router;
