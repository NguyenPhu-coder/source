import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function EditCourse() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentUploadMethod, setDocumentUploadMethod] = useState<
    "url" | "file"
  >("url");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [lessons, setLessons] = useState<any[]>([]);
  const [showAddLessonModal, setShowAddLessonModal] = useState(false);
  const [newLesson, setNewLesson] = useState({
    title: "",
    content: "",
    duration: 0,
    order_index: 1,
    lesson_type: "video",
    video_url: "",
    content_text: "",
    document_url: "",
  });

  const [formData, setFormData] = useState({
    title_en: "",
    title_vi: "",
    description_en: "",
    description_vi: "",
    thumbnail: "",
    category_id: "",
    price: "",
    level: "beginner",
    language: "vi",
  });

  useEffect(() => {
    if (id) {
      fetchCourse();
      fetchLessons(parseInt(id));
    }
  }, [id]);

  const fetchCourse = async () => {
    try {
      setFetching(true);
      const token = localStorage.getItem("token");
      const response = await fetch(`http://127.0.0.1:3000/api/courses/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();

      if (result.success) {
        const course = result.data;
        setFormData({
          title_en: course.title_en || "",
          title_vi: course.title_vi || "",
          description_en: course.description_en || "",
          description_vi: course.description_vi || "",
          thumbnail: course.thumbnail || "",
          category_id: course.category_id?.toString() || "",
          price: course.price?.toString() || "0",
          level: course.level || "beginner",
          language: course.language || "vi",
        });
        setThumbnailPreview(course.thumbnail || "");
      }
    } catch (error) {
      console.error("Error fetching course:", error);
      toast({
        title: "Lỗi",
        description: "Không thể tải thông tin khóa học",
        variant: "destructive",
      });
    } finally {
      setFetching(false);
    }
  };

  const fetchLessons = async (courseId: number) => {
    try {
      const token = localStorage.getItem("token");
      const url = `http://127.0.0.1:3000/api/courses/${courseId}/lessons`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setLessons(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching lessons:", error);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Lỗi",
          description: "Kích thước file không được vượt quá 5MB",
          variant: "destructive",
        });
        return;
      }

      if (!file.type.startsWith("image/")) {
        toast({
          title: "Lỗi",
          description: "Vui lòng chọn file ảnh",
          variant: "destructive",
        });
        return;
      }

      // Store file for upload
      setSelectedFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title_en || !formData.title_vi || !formData.category_id) {
      toast({
        title: "Lỗi",
        description: "Vui lòng điền đầy đủ thông tin bắt buộc",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      // Create FormData for file upload
      const submitData = new FormData();
      submitData.append("title_en", formData.title_en);
      submitData.append("title_vi", formData.title_vi);
      submitData.append("description_en", formData.description_en || "");
      submitData.append("description_vi", formData.description_vi || "");
      submitData.append("category_id", formData.category_id);
      submitData.append("price", formData.price);
      submitData.append("level", formData.level);
      
      // Add thumbnail file if selected
      if (selectedFile) {
        submitData.append("thumbnail", selectedFile);
      }

      const response = await fetch(`http://127.0.0.1:3000/api/courses/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: submitData,
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Thành công",
          description: "Đã cập nhật khóa học",
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể cập nhật khóa học",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddLesson = () => {
    setShowAddLessonModal(true);
    setDocumentUploadMethod("url");
    setDocumentFile(null);
    setNewLesson({
      title: "",
      content: "",
      duration: 0,
      order_index: lessons.length + 1,
      lesson_type: "video",
      video_url: "",
      content_text: "",
      document_url: "",
    });
  };

  const handleDocumentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type and size
      const validTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ];
      if (!validTypes.includes(file.type)) {
        toast({
          title: "Lỗi",
          description: "Chỉ hỗ trợ file PDF, DOC, DOCX, PPT, PPTX",
          variant: "destructive",
        });
        return;
      }

      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        toast({
          title: "Lỗi",
          description: "File quá lớn. Tối đa 50MB",
          variant: "destructive",
        });
        return;
      }

      setDocumentFile(file);
    }
  };

  const uploadDocumentFile = async (): Promise<string | null> => {
    if (!documentFile) return null;

    try {
      setUploadingDocument(true);
      const formData = new FormData();
      formData.append("document", documentFile);

      const token = localStorage.getItem("token");
      const response = await fetch(
        "http://127.0.0.1:3000/api/instructor/upload-document",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Thành công",
          description: "Đã tải lên tài liệu",
        });
        return result.data.url;
      } else {
        throw new Error(result.message || "Upload failed");
      }
    } catch (error) {
      console.error("Error uploading document:", error);
      toast({
        title: "Lỗi",
        description: "Không thể tải lên tài liệu",
        variant: "destructive",
      });
      return null;
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleSaveNewLesson = async () => {
    if (!newLesson.title.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập tên bài học",
        variant: "destructive",
      });
      return;
    }

    // Validate based on lesson type
    if (newLesson.lesson_type === "video" && !newLesson.video_url.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập URL video",
        variant: "destructive",
      });
      return;
    }

    if (newLesson.lesson_type === "text" && !newLesson.content_text.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập nội dung text",
        variant: "destructive",
      });
      return;
    }

    if (newLesson.lesson_type === "document") {
      if (documentUploadMethod === "url" && !newLesson.document_url.trim()) {
        toast({
          title: "Lỗi",
          description: "Vui lòng nhập URL tài liệu hoặc chọn file",
          variant: "destructive",
        });
        return;
      }
      if (documentUploadMethod === "file" && !documentFile) {
        toast({
          title: "Lỗi",
          description: "Vui lòng chọn file tài liệu",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      // Upload document file if needed
      let finalDocumentUrl = newLesson.document_url;
      if (
        documentUploadMethod === "file" &&
        documentFile &&
        (newLesson.lesson_type === "document" ||
          newLesson.lesson_type === "mixed")
      ) {
        const uploadedUrl = await uploadDocumentFile();
        if (!uploadedUrl) {
          toast({
            title: "Lỗi",
            description: "Không thể tải lên file tài liệu",
            variant: "destructive",
          });
          return;
        }
        finalDocumentUrl = uploadedUrl;
      }

      const token = localStorage.getItem("token");

      const requestBody = {
        course_id: parseInt(id!),
        title_en: newLesson.title,
        title_vi: newLesson.title,
        description_en: newLesson.content,
        description_vi: newLesson.content,
        lesson_type: newLesson.lesson_type,
        video_url:
          newLesson.lesson_type === "video" || newLesson.lesson_type === "mixed"
            ? newLesson.video_url
            : null,
        content_text:
          newLesson.lesson_type === "text" || newLesson.lesson_type === "mixed"
            ? newLesson.content_text
            : null,
        document_url:
          newLesson.lesson_type === "document" ||
          newLesson.lesson_type === "mixed"
            ? finalDocumentUrl
            : null,
        duration: newLesson.duration,
        order_index: newLesson.order_index,
      };

      const response = await fetch(
        "http://127.0.0.1:3000/api/instructor/lessons",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      const responseData = await response.json();

      if (response.ok) {
        toast({
          title: "Thành công",
          description: "Đã thêm bài học mới",
        });
        setShowAddLessonModal(false);
        if (id) fetchLessons(parseInt(id));
      } else {
        throw new Error("Failed to create lesson");
      }
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể thêm bài học",
        variant: "destructive",
      });
    }
  };

  const handleDeleteLesson = async (lessonId: number) => {
    if (!confirm("Bạn có chắc muốn xóa bài học này?")) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `http://127.0.0.1:3000/api/instructor/lessons/${lessonId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        toast({
          title: "Thành công",
          description: "Đã xóa bài học",
        });
        if (id) fetchLessons(parseInt(id));
      }
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể xóa bài học",
        variant: "destructive",
      });
    }
  };

  if (fetching) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-gray-600">Đang tải...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="ghost"
              onClick={() => navigate("/instructor/courses")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Chỉnh sửa khóa học
              </h1>
              <p className="text-gray-600">
                Cập nhật thông tin và quản lý bài học
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="lg:col-span-2">
              <form
                onSubmit={handleSubmit}
                className="bg-white rounded-lg border border-gray-200 p-8 space-y-6"
              >
                {/* Basic Info */}
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-gray-900">
                    Thông tin cơ bản
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="title_en">
                        Tên khóa học (Tiếng Anh) *
                      </Label>
                      <Input
                        id="title_en"
                        value={formData.title_en}
                        onChange={(e) =>
                          handleChange("title_en", e.target.value)
                        }
                        placeholder="Introduction to Python"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="title_vi">
                        Tên khóa học (Tiếng Việt) *
                      </Label>
                      <Input
                        id="title_vi"
                        value={formData.title_vi}
                        onChange={(e) =>
                          handleChange("title_vi", e.target.value)
                        }
                        placeholder="Nhập môn Python"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="description_en">Mô tả (Tiếng Anh)</Label>
                      <Textarea
                        id="description_en"
                        value={formData.description_en}
                        onChange={(e) =>
                          handleChange("description_en", e.target.value)
                        }
                        placeholder="Learn Python programming from scratch..."
                        rows={4}
                      />
                    </div>
                    <div>
                      <Label htmlFor="description_vi">Mô tả (Tiếng Việt)</Label>
                      <Textarea
                        id="description_vi"
                        value={formData.description_vi}
                        onChange={(e) =>
                          handleChange("description_vi", e.target.value)
                        }
                        placeholder="Học lập trình Python từ đầu..."
                        rows={4}
                      />
                    </div>
                  </div>
                </div>

                {/* Course Details */}
                <div className="space-y-4 pt-6 border-t border-gray-200">
                  <h2 className="text-xl font-bold text-gray-900">
                    Chi tiết khóa học
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="category_id">Danh mục *</Label>
                      <Select
                        value={formData.category_id}
                        onValueChange={(value) =>
                          handleChange("category_id", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn danh mục" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Công nghệ</SelectItem>
                          <SelectItem value="2">Kinh doanh</SelectItem>
                          <SelectItem value="3">Thiết kế</SelectItem>
                          <SelectItem value="4">Marketing</SelectItem>
                          <SelectItem value="5">Phát triển cá nhân</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="price">Giá (VNĐ)</Label>
                      <Input
                        id="price"
                        type="number"
                        value={formData.price}
                        onChange={(e) => handleChange("price", e.target.value)}
                        placeholder="0"
                        min="0"
                        step="1000"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Để trống hoặc 0 nếu miễn phí
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="level">Cấp độ</Label>
                      <Select
                        value={formData.level}
                        onValueChange={(value) => handleChange("level", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="beginner">Cơ bản</SelectItem>
                          <SelectItem value="intermediate">
                            Trung cấp
                          </SelectItem>
                          <SelectItem value="advanced">Nâng cao</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="language">Ngôn ngữ</Label>
                      <Select
                        value={formData.language}
                        onValueChange={(value) =>
                          handleChange("language", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vi">Tiếng Việt</SelectItem>
                          <SelectItem value="en">Tiếng Anh</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Thumbnail */}
                <div className="space-y-4 pt-6 border-t border-gray-200">
                  <h2 className="text-xl font-bold text-gray-900">Hình ảnh</h2>

                  <div>
                    <Label htmlFor="thumbnailFile">Upload Thumbnail</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="thumbnailFile"
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="cursor-pointer"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Chọn file ảnh từ máy tính (tối đa 5MB)
                    </p>
                  </div>

                  {thumbnailPreview && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Xem trước:
                      </p>
                      <img
                        src={thumbnailPreview}
                        alt="Thumbnail preview"
                        className="w-full max-w-md h-48 object-cover rounded-lg border border-gray-200"
                        onError={() => setThumbnailPreview("")}
                      />
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-4 pt-6 border-t border-gray-200">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {loading ? "Đang lưu..." : "Cập nhật khóa học"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/instructor/courses")}
                  >
                    Quay lại
                  </Button>
                </div>
              </form>
            </div>

            {/* Lessons Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white border border-gray-200 rounded-lg p-6 sticky top-20">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Bài học</h2>
                  <Button size="sm" onClick={handleAddLesson}>
                    <Plus className="w-4 h-4 mr-1" />
                    Thêm
                  </Button>
                </div>

                <div className="space-y-2">
                  {lessons.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      Chưa có bài học nào
                    </p>
                  ) : (
                    lessons.map((lesson, index) => (
                      <div
                        key={lesson.id}
                        className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {index + 1}. {lesson.title}
                              </p>
                              {lesson.lesson_type && (
                                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 flex-shrink-0">
                                  {lesson.lesson_type === "video" && "📹"}
                                  {lesson.lesson_type === "text" && "📝"}
                                  {lesson.lesson_type === "document" && "📄"}
                                  {lesson.lesson_type === "quiz" && "❓"}
                                  {lesson.lesson_type === "mixed" && "🎯"}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">
                              {lesson.duration > 0 && `${lesson.duration} phút`}
                              {lesson.lesson_type === "text" &&
                                lesson.content_text &&
                                " • Có nội dung text"}
                              {lesson.lesson_type === "document" &&
                                lesson.document_url &&
                                " • Có tài liệu"}
                              {lesson.lesson_type === "video" &&
                                lesson.video_url &&
                                " • Có video"}
                              {lesson.lesson_type === "mixed" && " • Hỗn hợp"}
                            </p>
                          </div>
                          <div className="flex gap-1 ml-2">
                            <button
                              onClick={() => handleDeleteLesson(lesson.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Xóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Add Lesson Modal */}
        {showAddLessonModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 my-8">
              <h3 className="text-lg font-semibold mb-4">Thêm bài học mới</h3>

              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tên bài học *
                  </label>
                  <input
                    type="text"
                    value={newLesson.title}
                    onChange={(e) =>
                      setNewLesson({ ...newLesson, title: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ví dụ: Giới thiệu về Python"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mô tả
                  </label>
                  <textarea
                    value={newLesson.content}
                    onChange={(e) =>
                      setNewLesson({ ...newLesson, content: e.target.value })
                    }
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Mô tả nội dung bài học"
                  />
                </div>

                {/* Lesson Type Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Loại bài học *
                  </label>
                  <select
                    value={newLesson.lesson_type}
                    onChange={(e) =>
                      setNewLesson({
                        ...newLesson,
                        lesson_type: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="video">📹 Video</option>
                    <option value="text">📝 Nội dung Text</option>
                    <option value="document">📄 Tài liệu (PDF/File)</option>
                    <option value="quiz">❓ Quiz/Bài tập</option>
                    <option value="mixed">
                      🎯 Hỗn hợp (Video + Text + Document)
                    </option>
                  </select>
                </div>

                {/* Video URL - Show for video and mixed */}
                {(newLesson.lesson_type === "video" ||
                  newLesson.lesson_type === "mixed") && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Video URL{" "}
                      {newLesson.lesson_type === "video" ? "*" : "(tùy chọn)"}
                    </label>
                    <input
                      type="text"
                      value={newLesson.video_url}
                      onChange={(e) =>
                        setNewLesson({
                          ...newLesson,
                          video_url: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://youtube.com/... hoặc https://vimeo.com/..."
                    />
                  </div>
                )}

                {/* Text Content - Show for text and mixed */}
                {(newLesson.lesson_type === "text" ||
                  newLesson.lesson_type === "mixed") && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nội dung Text{" "}
                      {newLesson.lesson_type === "text" ? "*" : "(tùy chọn)"}
                    </label>
                    <textarea
                      value={newLesson.content_text}
                      onChange={(e) =>
                        setNewLesson({
                          ...newLesson,
                          content_text: e.target.value,
                        })
                      }
                      rows={6}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      placeholder="Nhập nội dung bài học dưới dạng text. Hỗ trợ Markdown: **bold**, *italic*, # tiêu đề, - danh sách..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      💡 Hỗ trợ Markdown để định dạng nội dung
                    </p>
                  </div>
                )}

                {/* Document - Show for document and mixed */}
                {(newLesson.lesson_type === "document" ||
                  newLesson.lesson_type === "mixed") && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tài liệu{" "}
                      {newLesson.lesson_type === "document"
                        ? "*"
                        : "(tùy chọn)"}
                    </label>

                    {/* Upload Method Selector */}
                    <div className="flex gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setDocumentUploadMethod("url")}
                        className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                          documentUploadMethod === "url"
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-300 text-gray-600 hover:border-gray-400"
                        }`}
                      >
                        🔗 URL
                      </button>
                      <button
                        type="button"
                        onClick={() => setDocumentUploadMethod("file")}
                        className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                          documentUploadMethod === "file"
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-300 text-gray-600 hover:border-gray-400"
                        }`}
                      >
                        📁 Upload file
                      </button>
                    </div>

                    {documentUploadMethod === "url" ? (
                      <input
                        type="text"
                        value={newLesson.document_url}
                        onChange={(e) =>
                          setNewLesson({
                            ...newLesson,
                            document_url: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="https://drive.google.com/... hoặc URL tài liệu PDF"
                      />
                    ) : (
                      <div>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.ppt,.pptx"
                          onChange={handleDocumentFileChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        {documentFile && (
                          <p className="text-sm text-green-600 mt-2">
                            ✓ Đã chọn: {documentFile.name} (
                            {(documentFile.size / 1024 / 1024).toFixed(2)} MB)
                          </p>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-gray-500 mt-1">
                      📎 Hỗ trợ: PDF, DOC, DOCX, PPT, PPTX (tối đa 50MB)
                    </p>
                  </div>
                )}

                {/* Quiz Note - Show for quiz type */}
                {newLesson.lesson_type === "quiz" && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      ℹ️ Sau khi tạo bài học, bạn có thể thêm câu hỏi quiz trong
                      trang quản lý chi tiết bài học.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Thứ tự
                    </label>
                    <input
                      type="number"
                      value={newLesson.order_index}
                      onChange={(e) =>
                        setNewLesson({
                          ...newLesson,
                          order_index: parseInt(e.target.value) || 1,
                        })
                      }
                      min="1"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Thời lượng (phút)
                    </label>
                    <input
                      type="number"
                      value={newLesson.duration}
                      onChange={(e) =>
                        setNewLesson({
                          ...newLesson,
                          duration: parseInt(e.target.value) || 0,
                        })
                      }
                      min="0"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={() => setShowAddLessonModal(false)}
                  variant="outline"
                  className="flex-1"
                  disabled={uploadingDocument}
                >
                  Hủy
                </Button>
                <Button
                  onClick={handleSaveNewLesson}
                  className="flex-1"
                  disabled={uploadingDocument}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {uploadingDocument ? "Đang tải lên..." : "Lưu"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
