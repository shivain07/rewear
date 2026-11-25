import { Router } from "express";
import { authenticate, requireRole } from "../auth/auth.middleware.js";
import {
    createBuyerRequest,
    getMyReceivedRequests,
    getMySentRequests,
    acceptRequest,
    declineRequest,
    cancelRequest
} from "./requests.controller.js";

const router = Router();

router.post(
    "/",
    authenticate,
    createBuyerRequest,
);

router.get(
    "/received",
    authenticate,
    requireRole("seller"),
    getMyReceivedRequests,
);

router.get(
    "/sent",
    authenticate,
    requireRole("buyer"),
    getMySentRequests,
);

router.patch(
    "/:id/accept",
    authenticate,
    requireRole("seller"),
    acceptRequest,
);

router.patch(
    "/:id/decline",
    authenticate,
    requireRole("seller"),
    declineRequest,
);

router.patch(
    "/:id/cancel",
    authenticate,
    requireRole("buyer"),
    cancelRequest,
);


export default router;