import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
    FileText,
    Clock,
    CheckCircle,
    AlertCircle,
    Upload,
    Calendar,
    Award,
} from "lucide-react";

interface Assignment {
    id: number;
    title: string;
    description: string;
    instructions: string;
    max_score: number;
    due_date: string;
    allow_late_submission: boolean;
    file_types_allowed: string;
    max_file_size: number;
    is_required: boolean;
    lesson_title: string;
    submission_id: number | null;
    submitted_at: string | null;
    submission_status: string | null;
    score: number | null;
    feedback: string | null;
    graded_at: string | null;
}

export default function StudentAssignments() {
    const { courseId } = useParams();
    const { toast } = useToast();
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState<number | null>(null);
    const [submissionForm, setSubmissionForm] = useState({
        file_url: "",
        submission_text: "",
    });

    useEffect(() => {
        fetchAssignments();
    }, [courseId]);

    const fetchAssignments = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem("token");
            const response = await fetch(
                `http://127.0.0.1:3000/api/assignments/student/courses/${courseId}/assignments`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            const data = await response.json();
            if (data.success) {
                setAssignments(data.assignments);
            }
        } catch (error) {
            console.error("Error fetching assignments:", error);
            toast({
                title: "Lỗi",
                description: "Không thể tải danh sách bài tập",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (assignmentId: number) => {
        if (!submissionForm.file_url && !submissionForm.submission_text) {
            toast({
                title: "Lỗi",
                description: "Vui lòng nhập nội dung hoặc link file",
                variant: "destructive",
            });
            return;
        }

        try {
            const token = localStorage.getItem("token");
            const response = await fetch(
                `http://127.0.0.1:3000/api/assignments/student/assignments/${assignmentId}/submit`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(submissionForm),
                }
            );

            const data = await response.json();
            if (data.success) {
                toast({
                    title: "Thành công",
                    description: data.isLate
                        ? "Đã nộp bài (muộn hạn)"
                        : "Đã nộp bài thành công",
                });
                setSubmitting(null);
                setSubmissionForm({ file_url: "", submission_text: "" });
                fetchAssignments();
            } else {
                throw new Error(data.message);
            }
        } catch (error: any) {
            toast({
                title: "Lỗi",
                description: error.message || "Không thể nộp bài",
                variant: "destructive",
            });
        }
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return "Không có hạn";
        return new Date(dateString).toLocaleDateString("vi-VN", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const isOverdue = (dueDate: string) => {
        if (!dueDate) return false;
        return new Date(dueDate) < new Date();
    };

    const getStatusBadge = (assignment: Assignment) => {
        if (assignment.submission_status === "graded") {
            return (
                <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    Đã chấm
                </span>
            );
        }
        if (assignment.submission_id) {
            return (
                <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Đã nộp
                </span>
            );
        }
        if (isOverdue(assignment.due_date)) {
            return (
                <span className="px-3 py-1 bg-red-100 text-red-700 text-sm font-medium rounded-full flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    Quá hạn
                </span>
            );
        }
        return (
            <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-sm font-medium rounded-full flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Chưa nộp
            </span>
        );
    };

    const pendingCount = assignments.filter((a) => !a.submission_id).length;
    const submittedCount = assignments.filter((a) => a.submission_id).length;
    const gradedCount = assignments.filter(
        (a) => a.submission_status === "graded"
    ).length;

    return (
        <Layout>
            <div className="container mx-auto px-4 py-8">
                {/* Header & Stats */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-6">
                        Bài tập của tôi
                    </h1>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white rounded-lg shadow p-4">
                            <div className="text-sm text-gray-600 mb-1">Chưa nộp</div>
                            <div className="text-2xl font-bold text-orange-600">
                                {pendingCount}
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow p-4">
                            <div className="text-sm text-gray-600 mb-1">Đã nộp</div>
                            <div className="text-2xl font-bold text-blue-600">
                                {submittedCount}
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow p-4">
                            <div className="text-sm text-gray-600 mb-1">Đã chấm điểm</div>
                            <div className="text-2xl font-bold text-green-600">
                                {gradedCount}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Assignments List */}
                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="text-gray-600 mt-4">Đang tải...</p>
                    </div>
                ) : assignments.length === 0 ? (
                    <div className="bg-white rounded-lg shadow p-12 text-center">
                        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                            Chưa có bài tập nào
                        </h3>
                        <p className="text-gray-600">
                            Giảng viên chưa giao bài tập cho khóa học này
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {assignments.map((assignment) => (
                            <div
                                key={assignment.id}
                                className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
                            >
                                {/* Header */}
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-xl font-semibold text-gray-900">
                                                {assignment.title}
                                            </h3>
                                            {assignment.is_required && (
                                                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                                                    Bắt buộc
                                                </span>
                                            )}
                                        </div>
                                        {assignment.description && (
                                            <p className="text-gray-600 mb-3">
                                                {assignment.description}
                                            </p>
                                        )}
                                    </div>
                                    {getStatusBadge(assignment)}
                                </div>

                                {/* Info */}
                                <div className="flex flex-wrap gap-6 text-sm text-gray-600 mb-4">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        <span
                                            className={
                                                isOverdue(assignment.due_date) && !assignment.submission_id
                                                    ? "text-red-600 font-medium"
                                                    : ""
                                            }
                                        >
                                            Hạn: {formatDate(assignment.due_date)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Award className="w-4 h-4" />
                                        <span>Điểm tối đa: {assignment.max_score}</span>
                                    </div>
                                    {assignment.lesson_title && (
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-4 h-4" />
                                            <span>Bài học: {assignment.lesson_title}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Instructions */}
                                {assignment.instructions && (
                                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                                        <div className="font-medium text-gray-900 mb-2">
                                            Hướng dẫn:
                                        </div>
                                        <p className="text-gray-700 whitespace-pre-wrap">
                                            {assignment.instructions}
                                        </p>
                                    </div>
                                )}

                                {/* Score Display */}
                                {assignment.submission_status === "graded" && (
                                    <div className="border-t pt-4 mb-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-medium text-gray-900">
                                                Điểm số:
                                            </span>
                                            <span className="text-2xl font-bold text-green-600">
                                                {assignment.score}/{assignment.max_score}
                                            </span>
                                        </div>
                                        {assignment.feedback && (
                                            <div>
                                                <div className="font-medium text-gray-900 mb-1">
                                                    Nhận xét:
                                                </div>
                                                <p className="text-gray-700">{assignment.feedback}</p>
                                            </div>
                                        )}
                                        <div className="text-sm text-gray-600 mt-2">
                                            Chấm lúc: {formatDate(assignment.graded_at!)}
                                        </div>
                                    </div>
                                )}

                                {/* Submission Form */}
                                {submitting === assignment.id ? (
                                    <div className="border-t pt-4 space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Link file (Google Drive, Dropbox, v.v.)
                                            </label>
                                            <input
                                                type="url"
                                                value={submissionForm.file_url}
                                                onChange={(e) =>
                                                    setSubmissionForm({
                                                        ...submissionForm,
                                                        file_url: e.target.value,
                                                    })
                                                }
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                placeholder="https://drive.google.com/..."
                                            />
                                            <p className="text-xs text-gray-500 mt-1">
                                                Định dạng cho phép: {assignment.file_types_allowed} (tối
                                                đa {assignment.max_file_size}MB)
                                            </p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Hoặc nhập nội dung bài làm
                                            </label>
                                            <textarea
                                                rows={6}
                                                value={submissionForm.submission_text}
                                                onChange={(e) =>
                                                    setSubmissionForm({
                                                        ...submissionForm,
                                                        submission_text: e.target.value,
                                                    })
                                                }
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                placeholder="Nhập bài làm của bạn..."
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => handleSubmit(assignment.id)}
                                                className="bg-green-600 hover:bg-green-700"
                                            >
                                                <Upload className="w-4 h-4 mr-2" />
                                                Nộp bài
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => setSubmitting(null)}
                                            >
                                                Hủy
                                            </Button>
                                        </div>
                                    </div>
                                ) : assignment.submission_id ? (
                                    <div className="border-t pt-4 text-sm text-gray-600">
                                        <div className="flex items-center gap-2 mb-2">
                                            <CheckCircle className="w-4 h-4 text-green-600" />
                                            <span>
                                                Đã nộp lúc: {formatDate(assignment.submitted_at!)}
                                            </span>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setSubmitting(assignment.id)}
                                        >
                                            Nộp lại
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="border-t pt-4">
                                        <Button
                                            onClick={() => setSubmitting(assignment.id)}
                                            className="bg-blue-600 hover:bg-blue-700"
                                            disabled={
                                                isOverdue(assignment.due_date) &&
                                                !assignment.allow_late_submission
                                            }
                                        >
                                            <Upload className="w-4 h-4 mr-2" />
                                            {isOverdue(assignment.due_date)
                                                ? assignment.allow_late_submission
                                                    ? "Nộp muộn"
                                                    : "Đã quá hạn"
                                                : "Nộp bài"}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    );
}
