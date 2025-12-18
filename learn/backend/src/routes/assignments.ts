import express from "express";
import { authenticate, AuthRequest } from "../middleware/auth.js";
import pool from "../config/db.js";
import logger from "../services/logger.js";

const router = express.Router();

// =============== INSTRUCTOR ENDPOINTS ===============

// Create assignment (instructor only)
router.post("/instructor/courses/:courseId/assignments", authenticate, async (req: AuthRequest, res) => {
    const connection = await pool.getConnection();

    try {
        const userId = req.user?.id;
        const { courseId } = req.params;
        const {
            lesson_id,
            title,
            description,
            instructions,
            max_score,
            due_date,
            allow_late_submission,
            file_types_allowed,
            max_file_size,
            is_required,
        } = req.body;

        if (!title || title.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Assignment title is required",
            });
        }

        // Check if user is instructor of this course
        const [courses] = await connection.query(
            "SELECT instructor_id FROM courses WHERE id = ?",
            [courseId]
        );

        if (courses.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Course not found",
            });
        }

        if (courses[0].instructor_id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Only the course instructor can create assignments",
            });
        }

        // Create assignment
        const [result] = await connection.query(
            `INSERT INTO assignments 
            (course_id, lesson_id, title, description, instructions, max_score, 
            due_date, allow_late_submission, file_types_allowed, max_file_size, is_required) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                courseId,
                lesson_id || null,
                title,
                description || null,
                instructions || null,
                max_score || 100,
                due_date || null,
                allow_late_submission !== undefined ? allow_late_submission : true,
                file_types_allowed || null,
                max_file_size || 10,
                is_required !== undefined ? is_required : false,
            ]
        );

        logger.info(`Instructor ${userId} created assignment ${result.insertId} for course ${courseId}`);

        res.status(201).json({
            success: true,
            message: "Assignment created successfully",
            assignmentId: result.insertId,
        });
    } catch (error) {
        logger.error("Error creating assignment:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create assignment",
            error: error.message,
        });
    } finally {
        connection.release();
    }
});

// Get all assignments for a course (instructor view)
router.get("/instructor/courses/:courseId/assignments", authenticate, async (req: AuthRequest, res) => {
    const connection = await pool.getConnection();

    try {
        const userId = req.user?.id;
        const { courseId } = req.params;

        // Check if user is instructor
        const [courses] = await connection.query(
            "SELECT instructor_id FROM courses WHERE id = ?",
            [courseId]
        );

        if (courses.length === 0 || courses[0].instructor_id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Access denied",
            });
        }

        const [assignments] = await connection.query(
            `SELECT 
                a.*,
                l.title_en as lesson_title,
                (SELECT COUNT(*) FROM assignment_submissions WHERE assignment_id = a.id) as total_submissions,
                (SELECT COUNT(*) FROM assignment_submissions WHERE assignment_id = a.id AND status = 'graded') as graded_count
            FROM assignments a
            LEFT JOIN lessons l ON a.lesson_id = l.id
            WHERE a.course_id = ?
            ORDER BY a.created_at DESC`,
            [courseId]
        );

        res.json({
            success: true,
            assignments,
            total: assignments.length,
        });
    } catch (error) {
        logger.error("Error getting assignments:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get assignments",
            error: error.message,
        });
    } finally {
        connection.release();
    }
});

// Get submissions for an assignment (instructor view)
router.get("/instructor/assignments/:assignmentId/submissions", authenticate, async (req: AuthRequest, res) => {
    const connection = await pool.getConnection();

    try {
        const userId = req.user?.id;
        const { assignmentId } = req.params;

        // Check if user is instructor
        const [assignments] = await connection.query(
            `SELECT a.id, c.instructor_id 
            FROM assignments a
            JOIN courses c ON a.course_id = c.id
            WHERE a.id = ?`,
            [assignmentId]
        );

        if (assignments.length === 0 || assignments[0].instructor_id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Access denied",
            });
        }

        const [submissions] = await connection.query(
            `SELECT 
                s.id,
                s.file_url,
                s.submission_text,
                s.submitted_at,
                s.is_late,
                s.status,
                u.id as student_id,
                u.name as student_name,
                u.email as student_email,
                g.score,
                g.feedback,
                g.graded_at
            FROM assignment_submissions s
            JOIN users u ON s.user_id = u.id
            LEFT JOIN assignment_grades g ON g.submission_id = s.id
            WHERE s.assignment_id = ?
            ORDER BY s.submitted_at DESC`,
            [assignmentId]
        );

        res.json({
            success: true,
            submissions,
            total: submissions.length,
        });
    } catch (error) {
        logger.error("Error getting submissions:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get submissions",
            error: error.message,
        });
    } finally {
        connection.release();
    }
});

// Grade a submission (instructor only)
router.post("/instructor/submissions/:submissionId/grade", authenticate, async (req: AuthRequest, res) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const userId = req.user?.id;
        const { submissionId } = req.params;
        const { score, feedback } = req.body;

        if (score === undefined || score === null) {
            return res.status(400).json({
                success: false,
                message: "Score is required",
            });
        }

        // Check if user is instructor
        const [submissions] = await connection.query(
            `SELECT s.id, a.max_score, c.instructor_id 
            FROM assignment_submissions s
            JOIN assignments a ON s.assignment_id = a.id
            JOIN courses c ON a.course_id = c.id
            WHERE s.id = ?`,
            [submissionId]
        );

        if (submissions.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: "Submission not found",
            });
        }

        if (submissions[0].instructor_id !== userId) {
            await connection.rollback();
            return res.status(403).json({
                success: false,
                message: "Access denied",
            });
        }

        const maxScore = submissions[0].max_score;
        if (score < 0 || score > maxScore) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: `Score must be between 0 and ${maxScore}`,
            });
        }

        // Check if grade already exists
        const [existingGrade] = await connection.query(
            "SELECT id FROM assignment_grades WHERE submission_id = ?",
            [submissionId]
        );

        if (existingGrade.length > 0) {
            // Update existing grade
            await connection.query(
                `UPDATE assignment_grades 
                SET score = ?, feedback = ?, instructor_id = ?, graded_at = CURRENT_TIMESTAMP
                WHERE submission_id = ?`,
                [score, feedback || null, userId, submissionId]
            );
        } else {
            // Create new grade
            await connection.query(
                `INSERT INTO assignment_grades 
                (submission_id, instructor_id, score, feedback) 
                VALUES (?, ?, ?, ?)`,
                [submissionId, userId, score, feedback || null]
            );
        }

        // Update submission status
        await connection.query(
            "UPDATE assignment_submissions SET status = 'graded' WHERE id = ?",
            [submissionId]
        );

        await connection.commit();

        logger.info(`Instructor ${userId} graded submission ${submissionId} with score ${score}`);

        res.json({
            success: true,
            message: "Submission graded successfully",
        });
    } catch (error) {
        await connection.rollback();
        logger.error("Error grading submission:", error);
        res.status(500).json({
            success: false,
            message: "Failed to grade submission",
            error: error.message,
        });
    } finally {
        connection.release();
    }
});

// Update assignment (instructor only)
router.put("/instructor/assignments/:assignmentId", authenticate, async (req: AuthRequest, res) => {
    const connection = await pool.getConnection();

    try {
        const userId = req.user?.id;
        const { assignmentId } = req.params;

        // Check if user is instructor
        const [assignments] = await connection.query(
            `SELECT a.id, c.instructor_id 
            FROM assignments a
            JOIN courses c ON a.course_id = c.id
            WHERE a.id = ?`,
            [assignmentId]
        );

        if (assignments.length === 0 || assignments[0].instructor_id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Access denied",
            });
        }

        const updates = [];
        const values = [];

        const allowedFields = [
            "title",
            "description",
            "instructions",
            "max_score",
            "due_date",
            "allow_late_submission",
            "file_types_allowed",
            "max_file_size",
            "is_required",
        ];

        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) {
                updates.push(`${field} = ?`);
                values.push(req.body[field]);
            }
        });

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No fields to update",
            });
        }

        values.push(assignmentId);

        await connection.query(
            `UPDATE assignments SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            values
        );

        logger.info(`Instructor ${userId} updated assignment ${assignmentId}`);

        res.json({
            success: true,
            message: "Assignment updated successfully",
        });
    } catch (error) {
        logger.error("Error updating assignment:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update assignment",
            error: error.message,
        });
    } finally {
        connection.release();
    }
});

// Delete assignment (instructor only)
router.delete("/instructor/assignments/:assignmentId", authenticate, async (req: AuthRequest, res) => {
    const connection = await pool.getConnection();

    try {
        const userId = req.user?.id;
        const { assignmentId } = req.params;

        // Check if user is instructor
        const [assignments] = await connection.query(
            `SELECT a.id, c.instructor_id 
            FROM assignments a
            JOIN courses c ON a.course_id = c.id
            WHERE a.id = ?`,
            [assignmentId]
        );

        if (assignments.length === 0 || assignments[0].instructor_id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Access denied",
            });
        }

        await connection.query("DELETE FROM assignments WHERE id = ?", [assignmentId]);

        logger.info(`Instructor ${userId} deleted assignment ${assignmentId}`);

        res.json({
            success: true,
            message: "Assignment deleted successfully",
        });
    } catch (error) {
        logger.error("Error deleting assignment:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete assignment",
            error: error.message,
        });
    } finally {
        connection.release();
    }
});

// =============== STUDENT ENDPOINTS ===============

// Get assignments for a course (student view)
router.get("/student/courses/:courseId/assignments", authenticate, async (req: AuthRequest, res) => {
    const connection = await pool.getConnection();

    try {
        const userId = req.user?.id;
        const { courseId } = req.params;

        // Check if student is enrolled
        const [enrollments] = await connection.query(
            "SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?",
            [userId, courseId]
        );

        if (enrollments.length === 0) {
            return res.status(403).json({
                success: false,
                message: "You must be enrolled to view assignments",
            });
        }

        const [assignments] = await connection.query(
            `SELECT 
                a.id,
                a.title,
                a.description,
                a.instructions,
                a.max_score,
                a.due_date,
                a.allow_late_submission,
                a.file_types_allowed,
                a.max_file_size,
                a.is_required,
                a.created_at,
                l.title_en as lesson_title,
                s.id as submission_id,
                s.submitted_at,
                s.status as submission_status,
                g.score,
                g.feedback,
                g.graded_at
            FROM assignments a
            LEFT JOIN lessons l ON a.lesson_id = l.id
            LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.user_id = ?
            LEFT JOIN assignment_grades g ON g.submission_id = s.id
            WHERE a.course_id = ?
            ORDER BY a.due_date ASC, a.created_at DESC`,
            [userId, courseId]
        );

        res.json({
            success: true,
            assignments,
            total: assignments.length,
        });
    } catch (error) {
        logger.error("Error getting assignments:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get assignments",
            error: error.message,
        });
    } finally {
        connection.release();
    }
});

// Submit assignment (student only)
router.post("/student/assignments/:assignmentId/submit", authenticate, async (req: AuthRequest, res) => {
    const connection = await pool.getConnection();

    try {
        const userId = req.user?.id;
        const { assignmentId } = req.params;
        const { file_url, submission_text } = req.body;

        if (!file_url && !submission_text) {
            return res.status(400).json({
                success: false,
                message: "Either file_url or submission_text is required",
            });
        }

        // Get assignment details
        const [assignments] = await connection.query(
            "SELECT course_id, due_date, allow_late_submission FROM assignments WHERE id = ?",
            [assignmentId]
        );

        if (assignments.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Assignment not found",
            });
        }

        const { course_id, due_date, allow_late_submission } = assignments[0];

        // Check if student is enrolled
        const [enrollments] = await connection.query(
            "SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?",
            [userId, course_id]
        );

        if (enrollments.length === 0) {
            return res.status(403).json({
                success: false,
                message: "You must be enrolled to submit assignments",
            });
        }

        // Check if late submission
        const isLate = due_date && new Date() > new Date(due_date);
        if (isLate && !allow_late_submission) {
            return res.status(400).json({
                success: false,
                message: "Late submissions are not allowed for this assignment",
            });
        }

        // Check if already submitted
        const [existing] = await connection.query(
            "SELECT id FROM assignment_submissions WHERE assignment_id = ? AND user_id = ?",
            [assignmentId, userId]
        );

        if (existing.length > 0) {
            // Update existing submission
            await connection.query(
                `UPDATE assignment_submissions 
                SET file_url = ?, submission_text = ?, submitted_at = CURRENT_TIMESTAMP, is_late = ?, status = 'submitted'
                WHERE id = ?`,
                [file_url || null, submission_text || null, isLate, existing[0].id]
            );

            logger.info(`User ${userId} resubmitted assignment ${assignmentId}`);

            return res.json({
                success: true,
                message: "Assignment resubmitted successfully",
                submissionId: existing[0].id,
            });
        }

        // Create new submission
        const [result] = await connection.query(
            `INSERT INTO assignment_submissions 
            (assignment_id, user_id, file_url, submission_text, is_late) 
            VALUES (?, ?, ?, ?, ?)`,
            [assignmentId, userId, file_url || null, submission_text || null, isLate]
        );

        logger.info(`User ${userId} submitted assignment ${assignmentId}`);

        res.status(201).json({
            success: true,
            message: "Assignment submitted successfully",
            submissionId: result.insertId,
            isLate,
        });
    } catch (error) {
        logger.error("Error submitting assignment:", error);
        res.status(500).json({
            success: false,
            message: "Failed to submit assignment",
            error: error.message,
        });
    } finally {
        connection.release();
    }
});

// Get student's submission and grade
router.get("/student/assignments/:assignmentId/submission", authenticate, async (req: AuthRequest, res) => {
    const connection = await pool.getConnection();

    try {
        const userId = req.user?.id;
        const { assignmentId } = req.params;

        const [submissions] = await connection.query(
            `SELECT 
                s.id,
                s.file_url,
                s.submission_text,
                s.submitted_at,
                s.is_late,
                s.status,
                g.score,
                g.feedback,
                g.graded_at,
                a.max_score
            FROM assignment_submissions s
            LEFT JOIN assignment_grades g ON g.submission_id = s.id
            JOIN assignments a ON s.assignment_id = a.id
            WHERE s.assignment_id = ? AND s.user_id = ?`,
            [assignmentId, userId]
        );

        if (submissions.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Submission not found",
            });
        }

        res.json({
            success: true,
            submission: submissions[0],
        });
    } catch (error) {
        logger.error("Error getting submission:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get submission",
            error: error.message,
        });
    } finally {
        connection.release();
    }
});

export default router;
