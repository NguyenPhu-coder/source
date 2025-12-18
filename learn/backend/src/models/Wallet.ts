import pool from "../config/db.js";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export interface WalletData extends RowDataPacket {
    id: number;
    user_id: number;
    balance: number;
    currency: string;
    status: string;
    created_at?: Date;
    updated_at?: Date;
}

export interface WalletTransactionData extends RowDataPacket {
    id: number;
    wallet_id: number;
    amount: number;
    type: "deposit" | "purchase" | "refund" | "withdraw";
    status: "pending" | "completed" | "failed" | "cancelled";
    reference_id?: string;
    description?: string;
    balance_before: number;
    balance_after: number;
    created_at?: Date;
}

export class WalletModel {
    // Get wallet by user ID
    static async findByUserId(userId: number): Promise<WalletData | null> {
        const [rows] = await pool.execute<WalletData[]>(
            "SELECT * FROM wallets WHERE user_id = ?",
            [userId]
        );
        return rows.length > 0 ? rows[0] : null;
    }

    // Create wallet
    static async create(userId: number): Promise<number> {
        const [result] = await pool.execute<ResultSetHeader>(
            "INSERT INTO wallets (user_id) VALUES (?)",
            [userId]
        );
        return result.insertId;
    }

    // Update balance (Atomic operation)
    static async updateBalance(
        userId: number,
        amount: number,
        type: "deposit" | "purchase" | "refund" | "withdraw",
        referenceId: string,
        description: string
    ): Promise<boolean> {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Get current wallet and lock row
            const [wallets] = await connection.execute<WalletData[]>(
                "SELECT * FROM wallets WHERE user_id = ? FOR UPDATE",
                [userId]
            );

            let wallet = wallets[0];
            if (!wallet) {
                // Create wallet if not exists (should have been created on register, but safety check)
                const [res] = await connection.execute<ResultSetHeader>(
                    "INSERT INTO wallets (user_id) VALUES (?)",
                    [userId]
                );
                const [newWallet] = await connection.execute<WalletData[]>(
                    "SELECT * FROM wallets WHERE id = ?",
                    [res.insertId]
                );
                wallet = newWallet[0];
            }

            const balanceBefore = parseFloat(wallet.balance.toString());
            const changeAmount = parseFloat(amount.toString());
            const balanceAfter = type === 'purchase' || type === 'withdraw'
                ? balanceBefore - changeAmount
                : balanceBefore + changeAmount;

            if (balanceAfter < 0) {
                throw new Error("Insufficient funds");
            }

            // Update wallet
            await connection.execute(
                "UPDATE wallets SET balance = ? WHERE id = ?",
                [balanceAfter, wallet.id]
            );

            // Create transaction record
            await connection.execute(
                `INSERT INTO wallet_transactions 
         (wallet_id, user_id, amount, type, status, reference_id, description, balance_before, balance_after)
         VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, ?)`,
                [wallet.id, userId, changeAmount, type, referenceId, description, balanceBefore, balanceAfter]
            );

            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // Get transactions
    static async getTransactions(userId: number, limit: number = 20, offset: number = 0): Promise<WalletTransactionData[]> {
        // Ensure limit and offset are integers
        const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
        const safeOffset = Math.max(0, Math.floor(offset));

        const [rows] = await pool.execute<WalletTransactionData[]>(
            `SELECT t.* 
       FROM wallet_transactions t
       JOIN wallets w ON t.wallet_id = w.id
       WHERE w.user_id = ?
       ORDER BY t.created_at DESC
       LIMIT ${safeLimit} OFFSET ${safeOffset}`,
            [userId]
        );
        return rows;
    }
}
