import express from "express";
import { walletController } from "../controllers/walletController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// Get wallet balance and transaction history
router.get("/balance", authenticate, walletController.getWallet);
router.get("/transactions", authenticate, walletController.getWallet); // Alias or explicit endpoint

// Test top-up (Development only)
router.post("/test-topup", authenticate, walletController.testTopUp);

// Deposit
router.post("/deposit", authenticate, walletController.deposit);

// Withdraw
router.post("/withdraw", authenticate, walletController.withdraw);

// IPN Callback (No auth required, verified by signature)
router.post("/ipn", walletController.handleIPN);

export default router;
