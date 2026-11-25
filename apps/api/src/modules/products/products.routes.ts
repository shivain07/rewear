
import { Router } from "express";

import {
    authenticate,
    requireRole,
} from "../auth/auth.middleware.js";

import {
    createProduct,
    getProducts,
    getProductById,
    updateProduct,
    archiveProduct,
} from "./products.controller.js";

import {
    generateUploadAuth,
    attachImage,
    removeImage,
} from "./products-images.controller.js";

const router = Router();

// Public routes
router.get("/", getProducts);
router.get("/:id", getProductById);

// Seller-only routes
router.post(
    "/",
    authenticate,
    requireRole("seller"),
    createProduct,
);

router.patch(
    "/:id",
    authenticate,
    requireRole("seller"),
    updateProduct,
);

router.delete(
    "/:id",
    authenticate,
    requireRole("seller"),
    archiveProduct,
);



// Product image routes
router.post(
    "/:id/images/upload-auth",
    authenticate,
    requireRole("seller"),
    generateUploadAuth,
);

router.post(
    "/:id/images",
    authenticate,
    requireRole("seller"),
    attachImage,
);

router.delete(
    "/:id/images/:imageId",
    authenticate,
    requireRole("seller"),
    removeImage,
);

export default router;
