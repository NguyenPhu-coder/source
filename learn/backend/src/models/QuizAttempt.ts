import pool from "../config/db.js";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export interface QuizAttemptData extends RowDataPacket {
  id: number;
  user_id: number;
  quiz_id: number;
  score: number;
  passed: boolean;
  time_taken: number;
  answers?: string;
  created_at?: Date;
}

export class QuizAttempt {
  // Get attempt by ID
  static async findById(id: number): Promise<QuizAttemptData | null> {
    const [rows] = await pool.execute<QuizAttemptData[]>(
      "SELECT * FROM quiz_attempts WHERE id = ?",
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  // Get attempts by user
  static async findByUserId(userId: number): Promise<QuizAttemptData[]> {
    const [rows] = await pool.execute<QuizAttemptData[]>(
      "SELECT * FROM quiz_attempts WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );
    return rows;
  }

  // Get attempts by quiz
  static async findByQuizId(quizId: number): Promise<QuizAttemptData[]> {
    const [rows] = await pool.execute<QuizAttemptData[]>(
      "SELECT * FROM quiz_attempts WHERE quiz_id = ? ORDER BY created_at DESC",
      [quizId]
    );
    return rows;
  }

  // Get attempts by user and quiz
  static async findByUserAndQuiz(
    userId: number,
    quizId: number
  ): Promise<QuizAttemptData[]> {
    const [rows] = await pool.execute<QuizAttemptData[]>(
      "SELECT * FROM quiz_attempts WHERE user_id = ? AND quiz_id = ? ORDER BY created_at DESC",
      [userId, quizId]
    );
    return rows;
  }

  // Get best attempt by user and quiz
  static async findBestAttempt(
    userId: number,
    quizId: number
  ): Promise<QuizAttemptData | null> {
    const [rows] = await pool.execute<QuizAttemptData[]>(
      "SELECT * FROM quiz_attempts WHERE user_id = ? AND quiz_id = ? ORDER BY score DESC LIMIT 1",
      [userId, quizId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  // Create attempt
  static async create(data: {
    user_id: number;
    quiz_id: number;
    score: number;
    passed: boolean;
    time_taken: number;
    answers?: string;
  }): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO quiz_attempts (user_id, quiz_id, score, passed, time_taken, answers) VALUES (?, ?, ?, ?, ?, ?)",
      [
        data.user_id,
        data.quiz_id,
        data.score,
        data.passed,
        data.time_taken,
        data.answers,
      ]
    );
    return result.insertId;
  }

  // Count attempts by user
  static async countByUserId(userId: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM quiz_attempts WHERE user_id = ?",
      [userId]
    );
    return rows[0].count;
  }

  // Count perfect scores by user
  static async countPerfectScoresByUserId(userId: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM quiz_attempts WHERE user_id = ? AND score = 100",
      [userId]
    );
    return rows[0].count;
  }

  // Count passed attempts by user
  static async countPassedByUserId(userId: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM quiz_attempts WHERE user_id = ? AND passed = 1",
      [userId]
    );
    return rows[0].count;
  }

  // Get average score by user
  static async getAverageScoreByUserId(userId: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT AVG(score) as avg_score FROM quiz_attempts WHERE user_id = ?",
      [userId]
    );
    return rows[0].avg_score || 0;
  }

  // Get quiz statistics
  static async getQuizStatistics(quizId: number): Promise<any> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        COUNT(*) as total_attempts,
        AVG(score) as avg_score,
        MAX(score) as max_score,
        MIN(score) as min_score,
        COUNT(DISTINCT user_id) as unique_users,
        SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as passed_count
       FROM quiz_attempts 
       WHERE quiz_id = ?`,
      [quizId]
    );
    return rows[0];
  }
}
