import pool from "../config/db.js";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export interface OrderData extends RowDataPacket {
  id: number;
  user_id: number;
  total_amount: number;
  coupon_id?: number;
  discount_amount?: number;
  final_amount: number;
  payment_method: string;
  payment_status: string;
  transaction_id?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface OrderItemData extends RowDataPacket {
  id: number;
  order_id: number;
  course_id: number;
  price: number;
  created_at?: Date;
}

export class Order {
  // Get order by ID
  static async findById(id: number): Promise<OrderData | null> {
    const [rows] = await pool.execute<OrderData[]>(
      "SELECT * FROM orders WHERE id = ?",
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  // Get orders by user
  static async findByUserId(userId: number): Promise<OrderData[]> {
    const [rows] = await pool.execute<OrderData[]>(
      "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );
    return rows;
  }

  // Create order
  static async create(data: {
    user_id: number;
    total_amount: number;
    coupon_id?: number;
    discount_amount?: number;
    final_amount: number;
    payment_method: string;
    payment_status: string;
    transaction_id?: string;
  }): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO orders (user_id, total_amount, coupon_id, discount_amount, final_amount, payment_method, payment_status, transaction_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.user_id,
        data.total_amount,
        data.coupon_id,
        data.discount_amount,
        data.final_amount,
        data.payment_method,
        data.payment_status,
        data.transaction_id,
      ]
    );
    return result.insertId;
  }

  // Update order status
  static async updateStatus(
    id: number,
    status: string,
    transactionId?: string
  ): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "UPDATE orders SET payment_status = ?, transaction_id = ? WHERE id = ?",
      [status, transactionId, id]
    );
    return result.affectedRows > 0;
  }

  // Get order with items
  static async findByIdWithItems(id: number): Promise<any> {
    const order = await this.findById(id);
    if (!order) return null;

    const items = await OrderItem.findByOrderId(id);
    return {
      ...order,
      items,
    };
  }

  // Get all orders with pagination
  static async findAll(
    page: number = 1,
    limit: number = 10
  ): Promise<{ orders: OrderData[]; total: number }> {
    const offset = (page - 1) * limit;

    const [orders] = await pool.execute<OrderData[]>(
      `SELECT * FROM orders ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
    );

    const [countResult] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as total FROM orders"
    );

    return {
      orders,
      total: countResult[0].total,
    };
  }
}

export class OrderItem {
  // Get items by order ID
  static async findByOrderId(orderId: number): Promise<OrderItemData[]> {
    const [rows] = await pool.execute<OrderItemData[]>(
      "SELECT * FROM order_items WHERE order_id = ?",
      [orderId]
    );
    return rows;
  }

  // Create order item
  static async create(data: {
    order_id: number;
    course_id: number;
    price: number;
  }): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO order_items (order_id, course_id, price) VALUES (?, ?, ?)",
      [data.order_id, data.course_id, data.price]
    );
    return result.insertId;
  }

  // Get course IDs by order ID
  static async getCourseIdsByOrderId(orderId: number): Promise<number[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT course_id FROM order_items WHERE order_id = ?",
      [orderId]
    );
    return rows.map((row) => row.course_id);
  }
}
