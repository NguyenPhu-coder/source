import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
    FileText,
    Clock,
    Search,
    BookOpen,
    Calendar,
    Edit,
    Trash2,
} from "lucide-react";

interface Note {
    id: number;
    content: string;
    timestamp: number | null;
    created_at: string;
    lesson_id: number;
    lesson_title: string;
    lesson_order: number;
}

export default function MyNotes() {
    const { courseId } = useParams();
    const { toast } = useToast();
    const [notes, setNotes] = useState<Note[]>([]);
    const [filteredNotes, setFilteredNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [courseName, setCourseName] = useState("");

    useEffect(() => {
        fetchNotes();
        if (courseId) {
            fetchCourseInfo();
        }
    }, [courseId]);

    useEffect(() => {
        if (searchQuery.trim()) {
            searchNotes(searchQuery);
        } else {
            setFilteredNotes(notes);
        }
    }, [searchQuery, notes]);

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

    const fetchNotes = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem("token");
            const response = await fetch(
                `http://127.0.0.1:3000/api/notes/courses/${courseId}/notes`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            const data = await response.json();
            if (data.success) {
                setNotes(data.notes);
                setFilteredNotes(data.notes);
            }
        } catch (error) {
            console.error("Error fetching notes:", error);
            toast({
                title: "Lỗi",
                description: "Không thể tải ghi chú",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const searchNotes = async (query: string) => {
        if (!query.trim()) {
            setFilteredNotes(notes);
            return;
        }

        try {
            const token = localStorage.getItem("token");
            const response = await fetch(
                `http://127.0.0.1:3000/api/notes/courses/${courseId}/notes/search?q=${encodeURIComponent(
                    query
                )}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            const data = await response.json();
            if (data.success) {
                setFilteredNotes(data.notes);
            }
        } catch (error) {
            console.error("Error searching notes:", error);
        }
    };

    const handleDelete = async (noteId: number) => {
        if (!confirm("Bạn có chắc muốn xóa ghi chú này?")) return;

        try {
            const token = localStorage.getItem("token");
            const response = await fetch(
                `http://127.0.0.1:3000/api/notes/notes/${noteId}`,
                {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            const data = await response.json();
            if (data.success) {
                toast({
                    title: "Thành công",
                    description: "Đã xóa ghi chú",
                });
                fetchNotes();
            } else {
                throw new Error(data.message);
            }
        } catch (error: any) {
            toast({
                title: "Lỗi",
                description: error.message || "Không thể xóa ghi chú",
                variant: "destructive",
            });
        }
    };

    const formatTime = (seconds: number | null) => {
        if (seconds === null) return "";
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
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

    // Group notes by lesson
    const notesByLesson = filteredNotes.reduce((acc, note) => {
        const key = note.lesson_id;
        if (!acc[key]) {
            acc[key] = {
                lesson_id: note.lesson_id,
                lesson_title: note.lesson_title,
                lesson_order: note.lesson_order,
                notes: [],
            };
        }
        acc[key].notes.push(note);
        return acc;
    }, {} as Record<number, any>);

    const lessonGroups = Object.values(notesByLesson).sort(
        (a, b) => a.lesson_order - b.lesson_order
    );

    return (
        <Layout>
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Ghi chú của tôi
                    </h1>
                    {courseName && (
                        <p className="text-gray-600">Khóa học: {courseName}</p>
                    )}
                </div>

                {/* Search */}
                <div className="mb-6">
                    <div className="relative max-w-xl">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Tìm kiếm trong ghi chú..."
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="text-sm text-gray-600 mb-1">Tổng ghi chú</div>
                        <div className="text-2xl font-bold text-gray-900">
                            {notes.length}
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="text-sm text-gray-600 mb-1">Bài học đã ghi chú</div>
                        <div className="text-2xl font-bold text-blue-600">
                            {Object.keys(notesByLesson).length}
                        </div>
                    </div>
                </div>

                {/* Notes List */}
                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="text-gray-600 mt-4">Đang tải...</p>
                    </div>
                ) : filteredNotes.length === 0 ? (
                    <div className="bg-white rounded-lg shadow p-12 text-center">
                        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                            {searchQuery ? "Không tìm thấy ghi chú" : "Chưa có ghi chú nào"}
                        </h3>
                        <p className="text-gray-600">
                            {searchQuery
                                ? "Thử tìm kiếm với từ khóa khác"
                                : "Bắt đầu ghi chú khi học bài để ghi nhớ kiến thức tốt hơn"}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {lessonGroups.map((group) => (
                            <div key={group.lesson_id} className="bg-white rounded-lg shadow">
                                {/* Lesson Header */}
                                <div className="p-4 border-b bg-gray-50">
                                    <div className="flex items-center gap-2">
                                        <BookOpen className="w-5 h-5 text-blue-600" />
                                        <h3 className="font-semibold text-gray-900">
                                            {group.lesson_title}
                                        </h3>
                                        <span className="text-sm text-gray-500">
                                            ({group.notes.length} ghi chú)
                                        </span>
                                    </div>
                                </div>

                                {/* Notes in this lesson */}
                                <div className="p-4 space-y-4">
                                    {group.notes.map((note: Note) => (
                                        <div
                                            key={note.id}
                                            className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                                    {note.timestamp !== null && (
                                                        <span className="flex items-center gap-1 text-blue-600 font-medium">
                                                            <Clock className="w-4 h-4" />
                                                            {formatTime(note.timestamp)}
                                                        </span>
                                                    )}
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="w-4 h-4" />
                                                        {formatDate(note.created_at)}
                                                    </span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Link
                                                        to={`/course/${courseId}/lesson/${note.lesson_id}`}
                                                        className="text-blue-600 hover:text-blue-700 text-sm"
                                                    >
                                                        Đến bài học
                                                    </Link>
                                                    <button
                                                        onClick={() => handleDelete(note.id)}
                                                        className="p-1 hover:bg-gray-100 rounded text-red-600"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                                                {note.content}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    );
}
