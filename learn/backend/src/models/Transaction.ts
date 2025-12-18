import pool from "../config/db.js";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export interface TransactionData extends RowDataPacket {
  id: number;
  order_id: number;
  gateway: string;
  transaction_id: string;
  amount: number;
  status: string;
  gateway_response?: string;
  created_at?: Date;
  updated_at?: Date;
}

export class Transaction {
  // Get transaction by ID
  static async findById(id: number): Promise<TransactionData | null> {
    const [rows] = await pool.execute<TransactionData[]>(
      "SELECT * FROM transactions WHERE id = ?",
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  // Get transaction by order ID
  static async findByOrderId(orderId: number): Promise<TransactionData[]> {
    const [rows] = await pool.execute<TransactionData[]>(
      "SELECT * FROM transactions WHERE order_id = ? ORDER BY created_at DESC",
      [orderId]
    );
    return rows;
  }

  // Get transaction by gateway transaction ID
  static async findByTransactionId(
    transactionId: string
  ): Promise<TransactionData | null> {
    const [rows] = await pool.execute<TransactionData[]>(
      "SELECT * FROM transactions WHERE transaction_id = ?",
      [transactionId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  // Create transaction
  static async create(data: {
    order_id: number;
    gateway: string;
    transaction_id: string;
    amount: number;
    status: string;
    gateway_response?: string;
  }): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO transactions (order_id, gateway, transaction_id, amount, status, gateway_response)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.order_id,
        data.gateway,
        data.transaction_id,
        data.amount,
        data.status,
        data.gateway_response,
      ]
    );
    return result.insertId;
  }

  // Update transaction status
  static async updateStatus(
    id: number,
    status: string,
    gatewayResponse?: string
  ): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "UPDATE transactions SET status = ?, gateway_response = ? WHERE id = ?",
      [status, gatewayResponse, id]
    );
    return result.affectedRows > 0;
  }

  // Get transactions by user
  static async findByUserId(userId: number): Promise<TransactionData[]> {
    const [rows] = await pool.execute<TransactionData[]>(
      `SELECT t.* FROM transactions t
       JOIN orders o ON t.order_id = o.id
       WHERE o.user_id = ?
       ORDER BY t.created_at DESC`,
      [userId]
    );
    return rows;
  }
}
