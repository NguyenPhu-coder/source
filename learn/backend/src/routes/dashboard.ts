import { Router } from "express";
import { dashboardController } from "../controllers/dashboardController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.get("/overview", authenticate, dashboardController.getOverview);

export default router;


