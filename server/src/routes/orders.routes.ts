import { Router } from "express";
import {
  createOrderHandler,
  getOrderEventsHandler,
  getOrderHandler,
  getUserOrdersHandler,
  updateOrderHandler,
  markSupportMessageReadHandler,
} from "../controllers/order.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.post("/", createOrderHandler);
router.get("/", getUserOrdersHandler);
router.get("/:orderId", getOrderHandler);
router.patch("/:orderId", updateOrderHandler);
router.get("/:orderId/events", getOrderEventsHandler);
router.post("/:orderId/support-message/read", markSupportMessageReadHandler);

export default router;
