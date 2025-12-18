import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
    Plus,
    Edit,
    Trash2,
    FileText,
    Clock,
    CheckCircle,
    Users,
} from "lucide-react";

interface Assignment {
    id: number;
    title: string;
    description: string;
    due_date: string;
    max_score: number;
    is_required: boolean;
    total_submissions: number;
    graded_count: number;
    created_at: string;
}

export default function InstructorAssignments() {
    const { courseId } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [courseName, setCourseName] = useState("");

    useEffect(() => {
        fetchAssignments();
        fetchCourseInfo();
    }, [courseId]);

    const fetchCourseInfo = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(
                `http://127.0.0.1:3000/api/courses/${courseId}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            const data = await response.json();
            if (data.success) {
                setCourseName(data.data.title_vi || data.data.title_en);
            }
        } catch (error) {
            console.error("Error fetching course:", error);
        }
    };

    const fetchAssignments = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem("token");
            const response = await fetch(
                `http://127.0.0.1:3000/api/assignments/instructor/courses/${courseId}/assignments`,
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

    const handleDelete = async (assignmentId: number) => {
        if (!confirm("Bạn có chắc muốn xóa bài tập này?")) return;

        try {
            const token = localStorage.getItem("token");
            const response = await fetch(
                `http://127.0.0.1:3000/api/assignments/instructor/assignments/${assignmentId}`,
                {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            const data = await response.json();
            if (data.success) {
                toast({
                    title: "Thành công",
                    description: "Đã xóa bài tập",
                });
                fetchAssignments();
            } else {
                throw new Error(data.message);
            }
        } catch (error: any) {
            toast({
                title: "Lỗi",
                description: error.message || "Không thể xóa bài tập",
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

    return (
        <Layout>
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            Quản lý Bài tập
                        </h1>
                        <p className="text-gray-600 mt-2">{courseName}</p>
                    </div>
                    <Button
                        onClick={() => navigate(`/instructor/courses/${courseId}/assignments/create`)}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Tạo bài tập mới
                    </Button>
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
                        <p className="text-gray-600 mb-6">
                            Tạo bài tập đầu tiên để giao cho học viên
                        </p>
                        <Button
                            onClick={() => navigate(`/instructor/courses/${courseId}/assignments/create`)}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Tạo bài tập
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {assignments.map((assignment) => (
                            <div
                                key={assignment.id}
                                className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
                            >
                                <div className="flex justify-between items-start">
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
                                            <p className="text-gray-600 mb-4 line-clamp-2">
                                                {assignment.description}
                                            </p>
                                        )}

                                        <div className="flex flex-wrap gap-6 text-sm text-gray-600">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4" />
                                                <span className={isOverdue(assignment.due_date) ? "text-red-600 font-medium" : ""}>
                                                    {formatDate(assignment.due_date)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Users className="w-4 h-4" />
                                                <span>
                                                    {assignment.total_submissions} bài nộp
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <CheckCircle className="w-4 h-4" />
                                                <span>
                                                    {assignment.graded_count}/{assignment.total_submissions} đã chấm
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-4 h-4" />
                                                <span>Điểm tối đa: {assignment.max_score}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 ml-4">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                navigate(`/instructor/assignments/${assignment.id}/submissions`)
                                            }
                                            className="text-blue-600 hover:text-blue-700"
                                        >
                                            <Users className="w-4 h-4 mr-1" />
                                            Xem bài nộp
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                navigate(`/instructor/courses/${courseId}/assignments/${assignment.id}/edit`)
                                            }
                                        >
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleDelete(assignment.id)}
                                            className="text-red-600 hover:text-red-700"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                {assignment.total_submissions > 0 && (
                                    <div className="mt-4">
                                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                                            <span>Tiến độ chấm điểm</span>
                                            <span>
                                                {Math.round((assignment.graded_count / assignment.total_submissions) * 100)}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div
                                                className="bg-green-600 h-2 rounded-full transition-all"
                                                style={{
                                                    width: `${(assignment.graded_count / assignment.total_submissions) * 100}%`,
                                                }}
                                            ></div>
                                        </div>
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
