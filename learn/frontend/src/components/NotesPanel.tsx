import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
    Plus,
    Edit,
    Trash2,
    Save,
    X,
    Clock,
    Search,
} from "lucide-react";

interface Note {
    id: number;
    content: string;
    timestamp: number | null;
    is_public: boolean;
    created_at: string;
    updated_at: string;
}

interface NotesPanelProps {
    lessonId: number;
    currentTime?: number;
}

export default function NotesPanel({ lessonId, currentTime = 0 }: NotesPanelProps) {
    const { toast } = useToast();
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingNote, setEditingNote] = useState<number | null>(null);
    const [newNote, setNewNote] = useState(false);
    const [noteForm, setNoteForm] = useState({
        content: "",
        timestamp: 0,
        is_public: false,
    });

    useEffect(() => {
        if (lessonId) {
            fetchNotes();
        }
    }, [lessonId]);

    const fetchNotes = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem("token");
            const response = await fetch(
                `http://127.0.0.1:3000/api/notes/lessons/${lessonId}/notes`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            const data = await response.json();
            if (data.success) {
                setNotes(data.notes);
            }
        } catch (error) {
            console.error("Error fetching notes:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!noteForm.content.trim()) {
            toast({
                title: "Lỗi",
                description: "Vui lòng nhập nội dung ghi chú",
                variant: "destructive",
            });
            return;
        }

        try {
            const token = localStorage.getItem("token");
            const response = await fetch(
                `http://127.0.0.1:3000/api/notes/lessons/${lessonId}/notes`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        ...noteForm,
                        timestamp: Math.floor(currentTime),
                    }),
                }
            );

            const data = await response.json();
            if (data.success) {
                toast({
                    title: "Thành công",
                    description: "Đã tạo ghi chú",
                });
                setNewNote(false);
                setNoteForm({ content: "", timestamp: 0, is_public: false });
                fetchNotes();
            } else {
                throw new Error(data.message);
            }
        } catch (error: any) {
            toast({
                title: "Lỗi",
                description: error.message || "Không thể tạo ghi chú",
                variant: "destructive",
            });
        }
    };

    const handleUpdate = async (noteId: number) => {
        if (!noteForm.content.trim()) {
            toast({
                title: "Lỗi",
                description: "Vui lòng nhập nội dung ghi chú",
                variant: "destructive",
            });
            return;
        }

        try {
            const token = localStorage.getItem("token");
            const response = await fetch(
                `http://127.0.0.1:3000/api/notes/notes/${noteId}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(noteForm),
                }
            );

            const data = await response.json();
            if (data.success) {
                toast({
                    title: "Thành công",
                    description: "Đã cập nhật ghi chú",
                });
                setEditingNote(null);
                setNoteForm({ content: "", timestamp: 0, is_public: false });
                fetchNotes();
            } else {
                throw new Error(data.message);
            }
        } catch (error: any) {
            toast({
                title: "Lỗi",
                description: error.message || "Không thể cập nhật ghi chú",
                variant: "destructive",
            });
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

    const startEdit = (note: Note) => {
        setEditingNote(note.id);
        setNoteForm({
            content: note.content,
            timestamp: note.timestamp || 0,
            is_public: note.is_public,
        });
    };

    const cancelEdit = () => {
        setEditingNote(null);
        setNewNote(false);
        setNoteForm({ content: "", timestamp: 0, is_public: false });
    };

    const formatTime = (seconds: number | null) => {
        if (seconds === null) return "";
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("vi-VN", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <div className="bg-white rounded-lg shadow-lg h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-semibold text-gray-900">Ghi chú của tôi</h3>
                <Button
                    size="sm"
                    onClick={() => {
                        setNewNote(true);
                        setNoteForm({
                            content: "",
                            timestamp: Math.floor(currentTime),
                            is_public: false,
                        });
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                >
                    <Plus className="w-4 h-4 mr-1" />
                    Thêm
                </Button>
            </div>

            {/* New Note Form */}
            {newNote && (
                <div className="p-4 border-b bg-blue-50">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <Clock className="w-4 h-4" />
                        <span>Tại: {formatTime(Math.floor(currentTime))}</span>
                    </div>
                    <textarea
                        value={noteForm.content}
                        onChange={(e) =>
                            setNoteForm({ ...noteForm, content: e.target.value })
                        }
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="Nhập ghi chú..."
                        autoFocus
                    />
                    <div className="flex items-center justify-between mt-2">
                        <label className="flex items-center text-sm text-gray-600">
                            <input
                                type="checkbox"
                                checked={noteForm.is_public}
                                onChange={(e) =>
                                    setNoteForm({ ...noteForm, is_public: e.target.checked })
                                }
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                            />
                            Công khai
                        </label>
                        <div className="flex gap-2">
                            <Button size="sm" onClick={handleCreate}>
                                <Save className="w-3 h-3 mr-1" />
                                Lưu
                            </Button>
                            <Button size="sm" variant="outline" onClick={cancelEdit}>
                                <X className="w-3 h-3" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Notes List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loading ? (
                    <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="text-sm text-gray-600 mt-2">Đang tải...</p>
                    </div>
                ) : notes.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <p className="text-sm">Chưa có ghi chú nào</p>
                        <p className="text-xs mt-1">Nhấn "Thêm" để tạo ghi chú đầu tiên</p>
                    </div>
                ) : (
                    notes.map((note) => (
                        <div
                            key={note.id}
                            className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors"
                        >
                            {editingNote === note.id ? (
                                <div>
                                    <textarea
                                        value={noteForm.content}
                                        onChange={(e) =>
                                            setNoteForm({ ...noteForm, content: e.target.value })
                                        }
                                        rows={4}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm mb-2"
                                        autoFocus
                                    />
                                    <div className="flex items-center justify-between">
                                        <label className="flex items-center text-sm text-gray-600">
                                            <input
                                                type="checkbox"
                                                checked={noteForm.is_public}
                                                onChange={(e) =>
                                                    setNoteForm({
                                                        ...noteForm,
                                                        is_public: e.target.checked,
                                                    })
                                                }
                                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                                            />
                                            Công khai
                                        </label>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                onClick={() => handleUpdate(note.id)}
                                            >
                                                <Save className="w-3 h-3 mr-1" />
                                                Lưu
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={cancelEdit}
                                            >
                                                <X className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-2">
                                        {note.timestamp !== null && (
                                            <span className="text-xs text-blue-600 font-medium">
                                                {formatTime(note.timestamp)}
                                            </span>
                                        )}
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => startEdit(note)}
                                                className="p-1 hover:bg-gray-200 rounded"
                                            >
                                                <Edit className="w-3 h-3 text-gray-600" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(note.id)}
                                                className="p-1 hover:bg-gray-200 rounded"
                                            >
                                                <Trash2 className="w-3 h-3 text-red-600" />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">
                                        {note.content}
                                    </p>
                                    <div className="flex items-center justify-between text-xs text-gray-500">
                                        <span>{formatDate(note.created_at)}</span>
                                        {note.is_public && (
                                            <span className="text-blue-600">Công khai</span>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
