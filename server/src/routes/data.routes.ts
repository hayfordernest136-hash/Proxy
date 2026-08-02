import { Router } from "express";
import {
  createDataOrderHandler,
  listDataBundlesHandler,
  trackDataOrderHandler,
} from "../controllers/data.controller";

const router = Router();

router.get("/bundles", listDataBundlesHandler);
router.get("/track", trackDataOrderHandler);
router.post("/orders", createDataOrderHandler);

export default router;
