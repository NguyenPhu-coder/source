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
    XCircle,
    Download,
    User,
    Calendar,
} from "lucide-react";

interface Submission {
    id: number;
    student_id: number;
    student_name: string;
    student_email: string;
    file_url: string;
    submission_text: string;
    submitted_at: string;
    is_late: boolean;
    status: string;
    score: number | null;
    feedback: string | null;
    graded_at: string | null;
}

interface Assignment {
    id: number;
    title: string;
    max_score: number;
}

export default function GradeSubmissions() {
    const { assignmentId } = useParams();
    const { toast } = useToast();
    const [assignment, setAssignment] = useState<Assignment | null>(null);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);
    const [gradingSubmission, setGradingSubmission] = useState<number | null>(
        null
    );
    const [gradeForm, setGradeForm] = useState({
        score: 0,
        feedback: "",
    });

    useEffect(() => {
        fetchSubmissions();
    }, [assignmentId]);

    const fetchSubmissions = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem("token");
            const response = await fetch(
                `http://127.0.0.1:3000/api/assignments/instructor/assignments/${assignmentId}/submissions`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            const data = await response.json();
            if (data.success) {
                setSubmissions(data.submissions);
                // Get assignment info from first submission or make separate call
                if (data.submissions.length > 0) {
                    // Fetch assignment details
                    fetchAssignmentDetails();
                }
            }
        } catch (error) {
            console.error("Error fetching submissions:", error);
            toast({
                title: "Lỗi",
                description: "Không thể tải danh sách bài nộp",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchAssignmentDetails = async () => {
        try {
            const token = localStorage.getItem("token");
            // We need to get assignment details - this requires knowing the course ID
            // For now, we'll set basic info from submissions
            setAssignment({
                id: parseInt(assignmentId!),
                title: "Bài tập",
                max_score: 100,
            });
        } catch (error) {
            console.error("Error fetching assignment:", error);
        }
    };

    const handleGrade = async (submissionId: number) => {
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(
                `http://127.0.0.1:3000/api/assignments/instructor/submissions/${submissionId}/grade`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(gradeForm),
                }
            );

            const data = await response.json();
            if (data.success) {
                toast({
                    title: "Thành công",
                    description: "Đã chấm điểm bài nộp",
                });
                setGradingSubmission(null);
                setGradeForm({ score: 0, feedback: "" });
                fetchSubmissions();
            } else {
                throw new Error(data.message);
            }
        } catch (error: any) {
            toast({
                title: "Lỗi",
                description: error.message || "Không thể chấm điểm",
                variant: "destructive",
            });
        }
    };

    const startGrading = (submission: Submission) => {
        setGradingSubmission(submission.id);
        setGradeForm({
            score: submission.score || 0,
            feedback: submission.feedback || "",
        });
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("vi-VN", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const gradedCount = submissions.filter((s) => s.status === "graded").length;
    const avgScore =
        submissions
            .filter((s) => s.score !== null)
            .reduce((sum, s) => sum + (s.score || 0), 0) /
        gradedCount || 0;

    return (
        <Layout>
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-4">
                        Bài nộp của học viên
                    </h1>

                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white rounded-lg shadow p-4">
                            <div className="text-sm text-gray-600 mb-1">Tổng bài nộp</div>
                            <div className="text-2xl font-bold text-gray-900">
                                {submissions.length}
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow p-4">
                            <div className="text-sm text-gray-600 mb-1">Đã chấm</div>
                            <div className="text-2xl font-bold text-green-600">
                                {gradedCount} / {submissions.length}
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow p-4">
                            <div className="text-sm text-gray-600 mb-1">Điểm trung bình</div>
                            <div className="text-2xl font-bold text-blue-600">
                                {avgScore.toFixed(1)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Submissions List */}
                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="text-gray-600 mt-4">Đang tải...</p>
                    </div>
                ) : submissions.length === 0 ? (
                    <div className="bg-white rounded-lg shadow p-12 text-center">
                        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                            Chưa có bài nộp nào
                        </h3>
                        <p className="text-gray-600">
                            Chưa có học viên nào nộp bài tập này
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {submissions.map((submission) => (
                            <div
                                key={submission.id}
                                className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
                            >
                                {/* Student Info */}
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                                            <User className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900">
                                                {submission.student_name}
                                            </h3>
                                            <p className="text-sm text-gray-600">
                                                {submission.student_email}
                                            </p>
                                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-4 h-4" />
                                                    {formatDate(submission.submitted_at)}
                                                </span>
                                                {submission.is_late && (
                                                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                                                        Nộp muộn
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {submission.status === "graded" ? (
                                        <div className="text-right">
                                            <div className="text-2xl font-bold text-green-600">
                                                {submission.score}/{assignment?.max_score || 100}
                                            </div>
                                            <div className="text-sm text-gray-600">Đã chấm</div>
                                        </div>
                                    ) : (
                                        <div className="text-right">
                                            <div className="text-sm text-orange-600 font-medium">
                                                Chưa chấm
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Submission Content */}
                                <div className="mb-4">
                                    {submission.file_url && (
                                        <div className="mb-3">
                                            <a
                                                href={submission.file_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
                                            >
                                                <Download className="w-4 h-4" />
                                                Tải file nộp bài
                                            </a>
                                        </div>
                                    )}
                                    {submission.submission_text && (
                                        <div className="bg-gray-50 rounded p-4">
                                            <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                                {submission.submission_text}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Grading Form */}
                                {gradingSubmission === submission.id ? (
                                    <div className="border-t pt-4 space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Điểm số (tối đa: {assignment?.max_score || 100})
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                max={assignment?.max_score || 100}
                                                value={gradeForm.score}
                                                onChange={(e) =>
                                                    setGradeForm({
                                                        ...gradeForm,
                                                        score: parseFloat(e.target.value),
                                                    })
                                                }
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Nhận xét
                                            </label>
                                            <textarea
                                                rows={4}
                                                value={gradeForm.feedback}
                                                onChange={(e) =>
                                                    setGradeForm({ ...gradeForm, feedback: e.target.value })
                                                }
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                placeholder="Nhận xét về bài làm của học viên..."
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => handleGrade(submission.id)}
                                                className="bg-green-600 hover:bg-green-700"
                                            >
                                                <CheckCircle className="w-4 h-4 mr-2" />
                                                Lưu điểm
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => setGradingSubmission(null)}
                                            >
                                                Hủy
                                            </Button>
                                        </div>
                                    </div>
                                ) : submission.status === "graded" && submission.feedback ? (
                                    <div className="border-t pt-4">
                                        <div className="text-sm font-medium text-gray-700 mb-2">
                                            Nhận xét:
                                        </div>
                                        <p className="text-gray-700 whitespace-pre-wrap">
                                            {submission.feedback}
                                        </p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => startGrading(submission)}
                                            className="mt-3"
                                        >
                                            Chỉnh sửa điểm
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="border-t pt-4">
                                        <Button
                                            onClick={() => startGrading(submission)}
                                            className="bg-blue-600 hover:bg-blue-700"
                                        >
                                            Chấm điểm
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
