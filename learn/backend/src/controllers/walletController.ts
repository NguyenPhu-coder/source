import { Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import { WalletModel } from "../models/Wallet.js";
import { createMoMoPayment, verifyMoMoSignature, parseMoMoResultCode } from "../utils/momo.js";
import { successResponse, errorResponse } from "../utils/response.js";
import pool from "../config/db.js";

export const walletController = {
    // Get wallet balance and transactions
    async getWallet(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json(errorResponse("Unauthorized"));

            let wallet = await WalletModel.findByUserId(userId);
            if (!wallet) {
                // Create wallet if not exists
                await WalletModel.create(userId);
                wallet = await WalletModel.findByUserId(userId);
            }

            const transactions = await WalletModel.getTransactions(userId, 50);

            res.json(successResponse({
                balance: wallet?.balance || 0,
                currency: wallet?.currency || 'VND',
                status: wallet?.status || 'active',
                transactions
            }));
        } catch (error: any) {
            console.error("Get wallet error:", error);
            res.status(500).json(errorResponse(error.message));
        }
    },

    // Test top-up (Development only - bypass MoMo)
    async testTopUp(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            const { amount } = req.body;

            if (!userId) return res.status(401).json(errorResponse("Unauthorized"));
            if (!amount || amount < 1000) {
                return res.status(400).json(errorResponse("Min amount is 1,000 VND"));
            }

            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();

                // Get wallet
                let wallet = await WalletModel.findByUserId(userId);
                if (!wallet) {
                    await WalletModel.create(userId);
                    wallet = await WalletModel.findByUserId(userId);
                }

                // Add balance using updateBalance (deposit type adds money)
                await WalletModel.updateBalance(
                    userId,
                    amount,
                    'deposit',
                    `TEST_${Date.now()}`,
                    'Test deposit (Development)'
                );

                await connection.commit();

                const updatedWallet = await WalletModel.findByUserId(userId);

                res.json(successResponse({
                    message: "Test top-up successful",
                    balance: updatedWallet?.balance || 0,
                    amount
                }));
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        } catch (error: any) {
            console.error("Test top-up error:", error);
            res.status(500).json(errorResponse(error.message));
        }
    },

    // Initiate deposit (create MoMo payment)
    async deposit(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            const { amount } = req.body;

            if (!amount || amount < 10000) {
                return res.status(400).json(errorResponse("Min deposit amount is 10,000 VND"));
            }

            const orderId = `DEP_${userId}_${Date.now()}`;
            const orderInfo = `Deposit into wallet - User ${userId}`;
            const requestId = orderId;

            // Create MoMo payment
            // Encode extraData as base64 (MoMo requirement)
            const extraDataObj = { userId, type: 'deposit' };
            const extraDataBase64 = Buffer.from(JSON.stringify(extraDataObj)).toString('base64');

            const paymentResponse = await createMoMoPayment({
                orderId,
                orderCode: orderId,
                amount,
                orderInfo,
                ipnUrl: "http://localhost:3000/api/wallet/ipn", // Needs public URL in prod
                returnUrl: "http://localhost:5173/wallet", // Frontend wallet page
                extraData: extraDataBase64
            });

            res.json(successResponse(paymentResponse));
        } catch (error: any) {
            console.error("Deposit error:", error);
            res.status(500).json(errorResponse(error.message));
        }
    },

    // MoMo IPN Callback
    async handleIPN(req: any, res: Response) {
        try {
            const {
                partnerCode,
                orderId,
                requestId,
                amount,
                orderInfo,
                orderType,
                transId,
                resultCode,
                message,
                payType,
                responseTime,
                extraData,
                signature
            } = req.body;

            console.log("🔔 Wallet IPN Received:", req.body);

            // Verify signature
            const isValid = verifyMoMoSignature(req.body);
            if (!isValid) {
                console.error("❌ Invalid IPN signature");
                return res.status(400).json({ message: "Invalid signature" });
            }

            if (resultCode === 0) {
                // Payment successful
                let data: any = {};
                try {
                    // Decode base64 extraData
                    const decodedData = Buffer.from(extraData, 'base64').toString('utf-8');
                    data = JSON.parse(decodedData);
                } catch (e) { }

                if (data.type === 'deposit' && data.userId) {
                    // Update wallet balance
                    await WalletModel.updateBalance(
                        data.userId,
                        amount,
                        "deposit",
                        transId.toString(),
                        `Deposit via MoMo (Order: ${orderId})`
                    );
                    console.log(`✅ Wallet updated for user ${data.userId}: +${amount}`);
                }
            } else {
                console.log(`❌ Payment failed: ${message}`);
            }

            res.json({ message: "IPN received" });
        } catch (error: any) {
            console.error("IPN error:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    },

    // Withdraw request (stub)
    async withdraw(req: AuthRequest, res: Response) {
        res.status(501).json(errorResponse("Withdrawal not implemented yet"));
    }
};
