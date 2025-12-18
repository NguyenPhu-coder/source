import { Router } from "express";
import { authController } from "../controllers/authController.js";
import { googleLogin } from "../controllers/googleAuthController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/me", authenticate, authController.getMe);
router.put("/profile", authenticate, authController.updateProfile);
router.put("/change-password", authenticate, authController.changePassword);

router.post("/google", googleLogin);

export default router;
