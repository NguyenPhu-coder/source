import pool from "../config/db.js";
import { ResultSetHeader, RowDataPacket } from "mysql2";

interface QuizData extends RowDataPacket {
  id: number;
  lesson_id: number;
  title_en: string;
  title_vi: string;
  description_en: string;
  description_vi: string;
  passing_score: number;
  time_limit: number;
  created_at: string;
}

interface QuestionData extends RowDataPacket {
  id: number;
  quiz_id: number;
  question_en: string;
  question_vi: string;
  question_type: string;
  order_index: number;
  points: number;
}

interface OptionData extends RowDataPacket {
  id: number;
  question_id: number;
  option_en: string;
  option_vi: string;
  is_correct: boolean;
  order_index: number;
}

class Quiz {
  // Get quiz by lesson ID
  static async getByLessonId(lessonId: number): Promise<QuizData | null> {
    const [rows] = await pool.query<QuizData[]>(
      "SELECT * FROM quizzes WHERE lesson_id = ?",
      [lessonId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  // Get quiz by ID with questions and options
  static async getQuizWithQuestions(quizId: number): Promise<any> {
    const [quiz] = await pool.query<QuizData[]>(
      "SELECT * FROM quizzes WHERE id = ?",
      [quizId]
    );

    if (quiz.length === 0) return null;

    const [questions] = await pool.query<QuestionData[]>(
      "SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY order_index ASC",
      [quizId]
    );

    const questionsWithOptions = await Promise.all(
      questions.map(async (question) => {
        const [options] = await pool.query<OptionData[]>(
          "SELECT * FROM quiz_options WHERE question_id = ? ORDER BY order_index ASC",
          [question.id]
        );
        return { ...question, options };
      })
    );

    return {
      ...quiz[0],
      questions: questionsWithOptions,
    };
  }

  // Create quiz
  static async create(data: {
    lesson_id: number;
    title_en: string;
    title_vi?: string;
    description_en?: string;
    description_vi?: string;
    passing_score?: number;
    time_limit?: number;
  }): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO quizzes 
       (lesson_id, title_en, title_vi, description_en, description_vi, passing_score, time_limit) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.lesson_id,
        data.title_en,
        data.title_vi || data.title_en,
        data.description_en || "",
        data.description_vi || "",
        data.passing_score || 70,
        data.time_limit || null,
      ]
    );
    return result.insertId;
  }

  // Add question to quiz
  static async addQuestion(data: {
    quiz_id: number;
    question_en: string;
    question_vi?: string;
    question_type: string;
    order_index: number;
    points?: number;
  }): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO quiz_questions 
       (quiz_id, question_en, question_vi, question_type, order_index, points) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.quiz_id,
        data.question_en,
        data.question_vi || data.question_en,
        data.question_type,
        data.order_index,
        data.points || 1,
      ]
    );
    return result.insertId;
  }

  // Add option to question
  static async addOption(data: {
    question_id: number;
    option_en: string;
    option_vi?: string;
    is_correct: boolean;
    order_index: number;
  }): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO quiz_options 
       (question_id, option_en, option_vi, is_correct, order_index) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        data.question_id,
        data.option_en,
        data.option_vi || data.option_en,
        data.is_correct,
        data.order_index,
      ]
    );
    return result.insertId;
  }

  // Submit quiz attempt
  static async submitAttempt(
    userId: number,
    quizId: number,
    answers: { question_id: number; selected_option_id: number }[]
  ): Promise<{
    attemptId: number;
    score: number;
    passed: boolean;
    totalPoints: number;
  }> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Get quiz with correct answers
      const [questions] = await connection.query<QuestionData[]>(
        "SELECT * FROM quiz_questions WHERE quiz_id = ?",
        [quizId]
      );

      let correctAnswers = 0;
      let totalPoints = 0;
      const maxPoints = questions.reduce((sum, q) => sum + q.points, 0);

      for (const answer of answers) {
        const [options] = await connection.query<OptionData[]>(
          "SELECT * FROM quiz_options WHERE question_id = ? AND id = ? AND is_correct = TRUE",
          [answer.question_id, answer.selected_option_id]
        );

        if (options.length > 0) {
          const question = questions.find((q) => q.id === answer.question_id);
          if (question) {
            correctAnswers++;
            totalPoints += question.points;
          }
        }
      }

      const score = Math.round((totalPoints / maxPoints) * 100);

      // Get passing score
      const [quiz] = await connection.query<QuizData[]>(
        "SELECT passing_score FROM quizzes WHERE id = ?",
        [quizId]
      );

      const passed = score >= (quiz[0]?.passing_score || 70);

      // Record attempt
      const [result] = await connection.query<ResultSetHeader>(
        "INSERT INTO quiz_attempts (user_id, quiz_id, score, passed, time_taken) VALUES (?, ?, ?, ?, ?)",
        [userId, quizId, score, passed, null]
      );

      await connection.commit();

      return {
        attemptId: result.insertId,
        score,
        passed,
        totalPoints,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Get user's quiz attempts
  static async getUserAttempts(
    userId: number,
    quizId: number
  ): Promise<RowDataPacket[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM quiz_attempts 
       WHERE user_id = ? AND quiz_id = ? 
       ORDER BY attempted_at DESC`,
      [userId, quizId]
    );
    return rows;
  }

  // Get best attempt
  static async getBestAttempt(
    userId: number,
    quizId: number
  ): Promise<RowDataPacket | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM quiz_attempts 
       WHERE user_id = ? AND quiz_id = ? 
       ORDER BY score DESC, attempted_at DESC 
       LIMIT 1`,
      [userId, quizId]
    );
    return rows.length > 0 ? rows[0] : null;
  }
}

export default Quiz;


