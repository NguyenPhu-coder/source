import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, X, CheckCircle } from "lucide-react";

export default function UploadLessonVideo() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [lesson, setLesson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchLesson();
  }, [lessonId]);

  const fetchLesson = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `http://127.0.0.1:3000/api/admin/lessons/${lessonId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setLesson(data.data);
      }
    } catch (error) {
      console.error("Error fetching lesson:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      "video/mp4",
      "video/webm",
      "video/ogg",
      "video/quicktime",
    ];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Lỗi",
        description: "Chỉ hỗ trợ file video định dạng MP4, WebM, OGG, MOV",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 500MB)
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "Lỗi",
        description: "Kích thước file không được vượt quá 500MB",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn file video",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("video", selectedFile);

      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percent);
        }
      });

      // Handle completion
      xhr.addEventListener("load", () => {
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          if (data.success) {
            toast({
              title: "Thành công",
              description: "Đã upload video thành công",
            });
            setTimeout(() => {
              navigate(-1);
            }, 1000);
          } else {
            toast({
              title: "Lỗi",
              description: data.message || "Không thể upload video",
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Lỗi",
            description: "Có lỗi xảy ra khi upload video",
            variant: "destructive",
          });
        }
        setUploading(false);
      });

      // Handle errors
      xhr.addEventListener("error", () => {
        toast({
          title: "Lỗi",
          description: "Có lỗi xảy ra khi upload video",
          variant: "destructive",
        });
        setUploading(false);
      });

      xhr.open(
        "POST",
        `http://127.0.0.1:3000/api/instructor/lessons/${lessonId}/upload-video`
      );
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.send(formData);
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Có lỗi xảy ra khi upload video",
        variant: "destructive",
      });
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Upload video bài học</h1>
            {lesson && <p className="text-gray-600 mt-1">{lesson.title}</p>}
          </div>
        </div>

        {/* Upload Area */}
        <div className="bg-white border border-gray-200 rounded-lg p-8">
          {!selectedFile ? (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
              <Upload className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Chọn file video để upload
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Hỗ trợ: MP4, WebM, OGG, MOV (Tối đa 500MB)
              </p>
              <label className="inline-block">
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button asChild>
                  <span>Chọn file</span>
                </Button>
              </label>
            </div>
          ) : (
            <div className="space-y-6">
              {/* File Info */}
              <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start gap-3 flex-1">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                {!uploading && (
                  <button
                    onClick={handleRemoveFile}
                    className="ml-2 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Video Preview */}
              {previewUrl && (
                <div className="rounded-lg overflow-hidden bg-black">
                  <video
                    src={previewUrl}
                    controls
                    className="w-full max-h-96"
                  />
                </div>
              )}

              {/* Upload Progress */}
              {uploading && (
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-600">Đang upload...</span>
                    <span className="font-semibold">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="flex-1"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? "Đang upload..." : "Upload video"}
                </Button>
                {!uploading && (
                  <Button variant="outline" onClick={handleRemoveFile}>
                    Chọn file khác
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Current Video */}
        {lesson?.video_url && (
          <div className="mt-6 bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3">Video hiện tại</h3>
            <div className="rounded-lg overflow-hidden bg-black">
              <video
                src={`http://127.0.0.1:3000${lesson.video_url}`}
                controls
                className="w-full max-h-96"
              />
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Upload video mới sẽ thay thế video hiện tại
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
