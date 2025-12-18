import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

export default function CreateAssignment() {
    const { courseId, assignmentId } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [lessons, setLessons] = useState<any[]>([]);
    const isEdit = !!assignmentId;

    const [formData, setFormData] = useState({
        lesson_id: "",
        title: "",
        description: "",
        instructions: "",
        max_score: 100,
        due_date: "",
        allow_late_submission: true,
        file_types_allowed: "pdf,doc,docx,txt",
        max_file_size: 10,
        is_required: false,
    });

    useEffect(() => {
        fetchLessons();
        if (isEdit) {
            fetchAssignment();
        }
    }, [courseId, assignmentId]);

    const fetchLessons = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(
                `http://127.0.0.1:3000/api/courses/${courseId}/lessons`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            const data = await response.json();
            if (data.success) {
                setLessons(data.data);
            }
        } catch (error) {
            console.error("Error fetching lessons:", error);
        }
    };

    const fetchAssignment = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(
                `http://127.0.0.1:3000/api/assignments/instructor/courses/${courseId}/assignments`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            const data = await response.json();
            if (data.success) {
                const assignment = data.assignments.find(
                    (a: any) => a.id === parseInt(assignmentId!)
                );
                if (assignment) {
                    setFormData({
                        lesson_id: assignment.lesson_id || "",
                        title: assignment.title,
                        description: assignment.description || "",
                        instructions: assignment.instructions || "",
                        max_score: assignment.max_score,
                        due_date: assignment.due_date
                            ? new Date(assignment.due_date).toISOString().slice(0, 16)
                            : "",
                        allow_late_submission: assignment.allow_late_submission,
                        file_types_allowed: assignment.file_types_allowed || "pdf,doc,docx,txt",
                        max_file_size: assignment.max_file_size,
                        is_required: assignment.is_required,
                    });
                }
            }
        } catch (error) {
            console.error("Error fetching assignment:", error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const token = localStorage.getItem("token");
            const url = isEdit
                ? `http://127.0.0.1:3000/api/assignments/instructor/assignments/${assignmentId}`
                : `http://127.0.0.1:3000/api/assignments/instructor/courses/${courseId}/assignments`;

            const response = await fetch(url, {
                method: isEdit ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    ...formData,
                    lesson_id: formData.lesson_id || null,
                    due_date: formData.due_date || null,
                }),
            });

            const data = await response.json();
            if (data.success) {
                toast({
                    title: "Thành công",
                    description: isEdit ? "Đã cập nhật bài tập" : "Đã tạo bài tập mới",
                });
                navigate(`/instructor/courses/${courseId}/assignments`);
            } else {
                throw new Error(data.message);
            }
        } catch (error: any) {
            toast({
                title: "Lỗi",
                description: error.message || "Không thể lưu bài tập",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout>
            <div className="container mx-auto px-4 py-8 max-w-3xl">
                <Button
                    variant="ghost"
                    onClick={() => navigate(`/instructor/courses/${courseId}/assignments`)}
                    className="mb-6"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Quay lại
                </Button>

                <div className="bg-white rounded-lg shadow p-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-6">
                        {isEdit ? "Chỉnh sửa Bài tập" : "Tạo Bài tập Mới"}
                    </h1>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Title */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Tiêu đề bài tập <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.title}
                                onChange={(e) =>
                                    setFormData({ ...formData, title: e.target.value })
                                }
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="VD: Bài tập tuần 1 - Biến và kiểu dữ liệu"
                            />
                        </div>

                        {/* Lesson */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Bài học (tùy chọn)
                            </label>
                            <select
                                value={formData.lesson_id}
                                onChange={(e) =>
                                    setFormData({ ...formData, lesson_id: e.target.value })
                                }
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="">-- Không liên kết với bài học --</option>
                                {lessons.map((lesson) => (
                                    <option key={lesson.id} value={lesson.id}>
                                        {lesson.title_vi || lesson.title_en}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Mô tả
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) =>
                                    setFormData({ ...formData, description: e.target.value })
                                }
                                rows={3}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Mô tả ngắn về bài tập..."
                            />
                        </div>

                        {/* Instructions */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Hướng dẫn chi tiết
                            </label>
                            <textarea
                                value={formData.instructions}
                                onChange={(e) =>
                                    setFormData({ ...formData, instructions: e.target.value })
                                }
                                rows={6}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Hướng dẫn chi tiết cách làm bài tập..."
                            />
                        </div>

                        {/* Max Score & Due Date */}
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Điểm tối đa
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.max_score}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            max_score: parseInt(e.target.value),
                                        })
                                    }
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Hạn nộp
                                </label>
                                <input
                                    type="datetime-local"
                                    value={formData.due_date}
                                    onChange={(e) =>
                                        setFormData({ ...formData, due_date: e.target.value })
                                    }
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        {/* File Settings */}
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Định dạng file cho phép
                                </label>
                                <input
                                    type="text"
                                    value={formData.file_types_allowed}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            file_types_allowed: e.target.value,
                                        })
                                    }
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="pdf,doc,docx,txt"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Các định dạng cách nhau bằng dấu phẩy
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Kích thước file tối đa (MB)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={formData.max_file_size}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            max_file_size: parseInt(e.target.value),
                                        })
                                    }
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        {/* Checkboxes */}
                        <div className="space-y-3">
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={formData.allow_late_submission}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            allow_late_submission: e.target.checked,
                                        })
                                    }
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">
                                    Cho phép nộp muộn
                                </span>
                            </label>

                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={formData.is_required}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            is_required: e.target.checked,
                                        })
                                    }
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">
                                    Bài tập bắt buộc
                                </span>
                            </label>
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-4 pt-4">
                            <Button
                                type="submit"
                                disabled={loading}
                                className="flex-1 bg-blue-600 hover:bg-blue-700"
                            >
                                {loading ? "Đang lưu..." : isEdit ? "Cập nhật" : "Tạo bài tập"}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => navigate(`/instructor/courses/${courseId}/assignments`)}
                            >
                                Hủy
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </Layout>
    );
}
