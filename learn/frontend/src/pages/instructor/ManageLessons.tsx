import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Plus,
  Save,
  Trash2,
  GripVertical,
  Video,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Lesson {
  id?: number;
  title_en: string;
  title_vi: string;
  description_en: string;
  description_vi: string;
  video_url: string;
  duration: number;
  order_index: number;
  is_free: boolean;
}

export default function ManageLessons() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [course, setCourse] = useState<any>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchCourseAndLessons();
  }, [id]);

  const fetchCourseAndLessons = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`http://127.0.0.1:3000/api/courses/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();
      console.log("Fetch course result:", result);

      if (result.success) {
        setCourse(result.data);
        const lessonsData = result.data.lessons || [];
        console.log("Setting lessons:", lessonsData);
        setLessons(lessonsData);
      }
    } catch (error) {
      console.error("Error fetching course:", error);
    }
  };

  const addLesson = () => {
    const newLesson: Lesson = {
      title_en: "",
      title_vi: "",
      description_en: "",
      description_vi: "",
      video_url: "",
      duration: 0,
      order_index: lessons.length + 1,
      is_free: false,
    };
    setLessons([...lessons, newLesson]);
    setEditingIndex(lessons.length);
  };

  const updateLesson = (index: number, field: string, value: any) => {
    const updatedLessons = [...lessons];
    updatedLessons[index] = { ...updatedLessons[index], [field]: value };
    setLessons(updatedLessons);
  };

  const deleteLesson = (index: number) => {
    if (confirm("Bạn có chắc muốn xóa bài học này?")) {
      const updatedLessons = lessons.filter((_, i) => i !== index);
      setLessons(updatedLessons);
    }
  };

  const moveLesson = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= lessons.length) return;

    const updatedLessons = [...lessons];
    [updatedLessons[index], updatedLessons[newIndex]] = [
      updatedLessons[newIndex],
      updatedLessons[index],
    ];

    // Update order_index
    updatedLessons.forEach((lesson, i) => {
      lesson.order_index = i + 1;
    });

    setLessons(updatedLessons);
  };

  const getYouTubeEmbedUrl = (url: string): string => {
    if (!url) return "";

    try {
      // Extract video ID from various YouTube URL formats
      let videoId = "";

      // Format: https://www.youtube.com/watch?v=VIDEO_ID
      if (url.includes("watch?v=")) {
        videoId = url.split("watch?v=")[1].split("&")[0];
      }
      // Format: https://youtu.be/VIDEO_ID
      else if (url.includes("youtu.be/")) {
        videoId = url.split("youtu.be/")[1].split("?")[0];
      }
      // Format: https://www.youtube.com/embed/VIDEO_ID
      else if (url.includes("embed/")) {
        videoId = url.split("embed/")[1].split("?")[0];
      }
      // Format: https://www.youtube.com/v/VIDEO_ID
      else if (url.includes("/v/")) {
        videoId = url.split("/v/")[1].split("?")[0];
      }

      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }

      return url; // Return original URL if can't parse
    } catch (error) {
      console.error("Error parsing YouTube URL:", error);
      return url;
    }
  };

  const saveLessons = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      // Validate lessons
      for (const lesson of lessons) {
        if (!lesson.title_en || !lesson.title_vi || !lesson.video_url) {
          toast({
            title: "Lỗi",
            description: "Vui lòng điền đầy đủ thông tin cho tất cả bài học",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      // Save each lesson
      for (const lesson of lessons) {
        const method = lesson.id ? "PUT" : "POST";
        const url = lesson.id
          ? `http://127.0.0.1:3000/api/instructor/lessons/${lesson.id}`
          : `http://127.0.0.1:3000/api/instructor/lessons`;

        const response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...lesson,
            course_id: parseInt(id!),
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || `Không thể lưu bài học: ${lesson.title_vi}`
          );
        }
      }

      toast({
        title: "Thành công",
        description: "Các bài học đã được lưu",
      });

      await fetchCourseAndLessons();
      setEditingIndex(null);
    } catch (error: any) {
      console.error("Error saving lessons:", error);
      toast({
        title: "Lỗi",
        description:
          error.message || "Không thể lưu bài học. Vui lòng thử lại.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/instructor")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Quản lý bài học
                </h1>
                <p className="text-gray-600">
                  {course?.title_vi || course?.title_en}
                </p>
              </div>
            </div>
            <Button
              onClick={addLesson}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Thêm bài học
            </Button>
          </div>

          {/* Lessons List */}
          <div className="space-y-4">
            {lessons.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <Video className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Chưa có bài học nào
                </h3>
                <p className="text-gray-600 mb-4">
                  Bắt đầu bằng cách thêm bài học đầu tiên
                </p>
                <Button
                  onClick={addLesson}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Thêm bài học
                </Button>
              </div>
            ) : (
              lessons.map((lesson, index) => (
                <div
                  key={index}
                  className="bg-white rounded-lg border border-gray-200 p-6"
                >
                  <div className="flex items-start gap-4">
                    {/* Drag Handle */}
                    <div className="flex flex-col gap-1 pt-2">
                      <button
                        onClick={() => moveLesson(index, "up")}
                        disabled={index === 0}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      >
                        ▲
                      </button>
                      <GripVertical className="w-5 h-5 text-gray-400" />
                      <button
                        onClick={() => moveLesson(index, "down")}
                        disabled={index === lessons.length - 1}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      >
                        ▼
                      </button>
                    </div>

                    {/* Lesson Content */}
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-gray-900">
                          Bài {index + 1}
                        </h3>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setEditingIndex(
                                editingIndex === index ? null : index
                              )
                            }
                          >
                            {editingIndex === index ? "Thu gọn" : "Mở rộng"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteLesson(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {editingIndex === index ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>Tiêu đề (Tiếng Anh) *</Label>
                              <Input
                                value={lesson.title_en}
                                onChange={(e) =>
                                  updateLesson(
                                    index,
                                    "title_en",
                                    e.target.value
                                  )
                                }
                                placeholder="Introduction"
                              />
                            </div>
                            <div>
                              <Label>Tiêu đề (Tiếng Việt) *</Label>
                              <Input
                                value={lesson.title_vi}
                                onChange={(e) =>
                                  updateLesson(
                                    index,
                                    "title_vi",
                                    e.target.value
                                  )
                                }
                                placeholder="Giới thiệu"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>Mô tả (Tiếng Anh)</Label>
                              <Textarea
                                value={lesson.description_en}
                                onChange={(e) =>
                                  updateLesson(
                                    index,
                                    "description_en",
                                    e.target.value
                                  )
                                }
                                rows={3}
                              />
                            </div>
                            <div>
                              <Label>Mô tả (Tiếng Việt)</Label>
                              <Textarea
                                value={lesson.description_vi}
                                onChange={(e) =>
                                  updateLesson(
                                    index,
                                    "description_vi",
                                    e.target.value
                                  )
                                }
                                rows={3}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <Label>URL Video *</Label>
                              <Input
                                value={lesson.video_url}
                                onChange={(e) =>
                                  updateLesson(
                                    index,
                                    "video_url",
                                    e.target.value
                                  )
                                }
                                placeholder="https://youtube.com/..."
                              />
                            </div>
                            <div>
                              <Label>Thời lượng (phút)</Label>
                              <Input
                                type="number"
                                value={lesson.duration}
                                onChange={(e) =>
                                  updateLesson(
                                    index,
                                    "duration",
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                min="0"
                              />
                            </div>
                            <div className="flex items-center gap-2 pt-6">
                              <input
                                type="checkbox"
                                id={`free-${index}`}
                                checked={lesson.is_free}
                                onChange={(e) =>
                                  updateLesson(
                                    index,
                                    "is_free",
                                    e.target.checked
                                  )
                                }
                                className="w-4 h-4"
                              />
                              <Label
                                htmlFor={`free-${index}`}
                                className="cursor-pointer"
                              >
                                Miễn phí
                              </Label>
                            </div>
                          </div>

                          {lesson.video_url && (
                            <div className="mt-4">
                              <Label>Xem trước video:</Label>
                              <div className="mt-2 aspect-video bg-gray-100 rounded-lg overflow-hidden">
                                <iframe
                                  src={getYouTubeEmbedUrl(lesson.video_url)}
                                  className="w-full h-full"
                                  allowFullScreen
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-600">
                          <p className="font-medium">
                            {lesson.title_vi ||
                              lesson.title_en ||
                              "Chưa có tiêu đề"}
                          </p>
                          <p className="text-gray-500">
                            {lesson.duration} phút •{" "}
                            {lesson.is_free ? "Miễn phí" : "Có phí"}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Actions */}
          {lessons.length > 0 && (
            <div className="flex gap-4 mt-8 pt-8 border-t border-gray-200">
              <Button
                onClick={saveLessons}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {loading ? "Đang lưu..." : "Lưu tất cả"}
              </Button>
              <Button variant="outline" onClick={() => navigate("/instructor")}>
                Quay lại
              </Button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
