import { Router } from "express";


import {
    getConversationMessagesController,
    getMyConversationsController,
    markConversationAsReadController,
    sendConversationMessageController,
} from "./conversations.controller.js";
import { authenticate } from "../auth/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/", getMyConversationsController);

router.get(
    "/:id/messages",
    getConversationMessagesController,
);

router.post(
    "/:id/messages",
    sendConversationMessageController,
);

router.patch(
    "/:id/read",
    markConversationAsReadController,
);

export default router;