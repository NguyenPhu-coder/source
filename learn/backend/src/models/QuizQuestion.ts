import pool from "../config/db.js";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export interface QuizQuestionData extends RowDataPacket {
  id: number;
  quiz_id: number;
  question_text_en: string;
  question_text_vi?: string;
  question_type: string;
  points: number;
  order_index: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface QuizOptionData extends RowDataPacket {
  id: number;
  question_id: number;
  option_text_en: string;
  option_text_vi?: string;
  is_correct: boolean;
  order_index: number;
  created_at?: Date;
}

export class QuizQuestion {
  // Get all questions for a quiz
  static async findByQuizId(quizId: number): Promise<QuizQuestionData[]> {
    const [rows] = await pool.execute<QuizQuestionData[]>(
      "SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY order_index ASC",
      [quizId]
    );
    return rows;
  }

  // Get question by ID
  static async findById(id: number): Promise<QuizQuestionData | null> {
    const [rows] = await pool.execute<QuizQuestionData[]>(
      "SELECT * FROM quiz_questions WHERE id = ?",
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  // Get question with options
  static async findByIdWithOptions(id: number): Promise<any> {
    const question = await this.findById(id);
    if (!question) return null;

    const options = await QuizOption.findByQuestionId(id);
    return {
      ...question,
      options,
    };
  }

  // Create question
  static async create(data: {
    quiz_id: number;
    question_text_en: string;
    question_text_vi?: string;
    question_type: string;
    points: number;
    order_index: number;
  }): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO quiz_questions (quiz_id, question_text_en, question_text_vi, question_type, points, order_index)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.quiz_id,
        data.question_text_en,
        data.question_text_vi,
        data.question_type,
        data.points,
        data.order_index,
      ]
    );
    return result.insertId;
  }

  // Update question
  static async update(
    id: number,
    data: Partial<{
      question_text_en: string;
      question_text_vi: string;
      question_type: string;
      points: number;
      order_index: number;
    }>
  ): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.question_text_en !== undefined) {
      fields.push("question_text_en = ?");
      values.push(data.question_text_en);
    }
    if (data.question_text_vi !== undefined) {
      fields.push("question_text_vi = ?");
      values.push(data.question_text_vi);
    }
    if (data.question_type !== undefined) {
      fields.push("question_type = ?");
      values.push(data.question_type);
    }
    if (data.points !== undefined) {
      fields.push("points = ?");
      values.push(data.points);
    }
    if (data.order_index !== undefined) {
      fields.push("order_index = ?");
      values.push(data.order_index);
    }

    if (fields.length === 0) return false;

    values.push(id);
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE quiz_questions SET ${fields.join(", ")} WHERE id = ?`,
      values
    );
    return result.affectedRows > 0;
  }

  // Delete question
  static async delete(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM quiz_questions WHERE id = ?",
      [id]
    );
    return result.affectedRows > 0;
  }
}

export class QuizOption {
  // Get all options for a question
  static async findByQuestionId(questionId: number): Promise<QuizOptionData[]> {
    const [rows] = await pool.execute<QuizOptionData[]>(
      "SELECT * FROM quiz_options WHERE question_id = ? ORDER BY order_index ASC",
      [questionId]
    );
    return rows;
  }

  // Get option by ID
  static async findById(id: number): Promise<QuizOptionData | null> {
    const [rows] = await pool.execute<QuizOptionData[]>(
      "SELECT * FROM quiz_options WHERE id = ?",
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  // Create option
  static async create(data: {
    question_id: number;
    option_text_en: string;
    option_text_vi?: string;
    is_correct: boolean;
    order_index: number;
  }): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO quiz_options (question_id, option_text_en, option_text_vi, is_correct, order_index)
       VALUES (?, ?, ?, ?, ?)`,
      [
        data.question_id,
        data.option_text_en,
        data.option_text_vi,
        data.is_correct,
        data.order_index,
      ]
    );
    return result.insertId;
  }

  // Update option
  static async update(
    id: number,
    data: Partial<{
      option_text_en: string;
      option_text_vi: string;
      is_correct: boolean;
      order_index: number;
    }>
  ): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.option_text_en !== undefined) {
      fields.push("option_text_en = ?");
      values.push(data.option_text_en);
    }
    if (data.option_text_vi !== undefined) {
      fields.push("option_text_vi = ?");
      values.push(data.option_text_vi);
    }
    if (data.is_correct !== undefined) {
      fields.push("is_correct = ?");
      values.push(data.is_correct);
    }
    if (data.order_index !== undefined) {
      fields.push("order_index = ?");
      values.push(data.order_index);
    }

    if (fields.length === 0) return false;

    values.push(id);
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE quiz_options SET ${fields.join(", ")} WHERE id = ?`,
      values
    );
    return result.affectedRows > 0;
  }

  // Delete option
  static async delete(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM quiz_options WHERE id = ?",
      [id]
    );
    return result.affectedRows > 0;
  }

  // Get correct options for a question
  static async getCorrectOptions(
    questionId: number
  ): Promise<QuizOptionData[]> {
    const [rows] = await pool.execute<QuizOptionData[]>(
      "SELECT * FROM quiz_options WHERE question_id = ? AND is_correct = 1",
      [questionId]
    );
    return rows;
  }
}
