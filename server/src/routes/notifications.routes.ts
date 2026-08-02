import { Router } from "express";
import {
  listNotificationsHandler,
  markNotificationsReadHandler,
} from "../controllers/notification.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();
router.use(requireAuth);
router.get("/", listNotificationsHandler);
router.post("/mark-read", markNotificationsReadHandler);

export default router;
