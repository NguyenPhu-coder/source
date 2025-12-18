import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileText, Eye } from "lucide-react";

export default function EditBlog() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    thumbnail: "",
    status: "draft" as "draft" | "published",
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    fetchBlog();
  }, [id]);

  const fetchBlog = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`http://127.0.0.1:3000/api/blogs/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setFormData({
          title: data.data.title,
          content: data.data.content,
          thumbnail: data.data.thumbnail || "",
          status: data.data.status,
        });
      } else {
        toast({
          title: "Lỗi",
          description: "Không thể tải blog",
          variant: "destructive",
        });
        navigate("/blogs/my-blogs");
      }
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Có lỗi xảy ra",
        variant: "destructive",
      });
      navigate("/blogs/my-blogs");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (
    e: React.FormEvent,
    status: "draft" | "published"
  ) => {
    e.preventDefault();

    if (!formData.title || !formData.content) {
      toast({
        title: "Lỗi",
        description: "Vui lòng điền đầy đủ tiêu đề và nội dung",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const token = localStorage.getItem("token");

      const response = await fetch(`http://127.0.0.1:3000/api/blogs/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          status,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Thành công",
          description: "Đã cập nhật blog",
        });
        navigate("/blogs/my-blogs");
      } else {
        toast({
          title: "Lỗi",
          description: data.message || "Không thể cập nhật blog",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Có lỗi xảy ra khi cập nhật blog",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white border border-gray-200 rounded-sm shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <p className="text-gray-600">Cập nhật nội dung blog của bạn</p>
          </div>

          <div className="p-6">
            {!preview ? (
              <form
                onSubmit={(e) => handleSubmit(e, "published")}
                className="space-y-6"
              >
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tiêu đề <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nhập tiêu đề blog"
                    required
                  />
                </div>

                {/* Thumbnail URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    URL ảnh thumbnail
                  </label>
                  <input
                    type="url"
                    value={formData.thumbnail}
                    onChange={(e) =>
                      setFormData({ ...formData, thumbnail: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://example.com/image.jpg"
                  />
                  {formData.thumbnail && (
                    <img
                      src={formData.thumbnail}
                      alt="Preview"
                      className="mt-2 w-full h-48 object-cover rounded-sm"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  )}
                </div>

                {/* Content */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <FileText className="w-4 h-4 inline mr-1" />
                    Nội dung <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) =>
                      setFormData({ ...formData, content: e.target.value })
                    }
                    rows={15}
                    className="w-full px-4 py-2 border border-gray-300 rounded-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Viết nội dung blog của bạn..."
                    required
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      onClick={() => setPreview(true)}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      Xem trước
                    </Button>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      onClick={() => navigate("/blogs/my-blogs")}
                      variant="outline"
                      disabled={submitting}
                    >
                      Hủy
                    </Button>
                    <Button
                      type="button"
                      onClick={(e) => handleSubmit(e, "draft")}
                      variant="outline"
                      disabled={submitting}
                    >
                      Lưu nháp
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? "Đang cập nhật..." : "Cập nhật"}
                    </Button>
                  </div>
                </div>
              </form>
            ) : (
              <div>
                {/* Preview */}
                <article className="prose prose-lg max-w-none">
                  <h1 className="text-3xl font-bold mb-4">{formData.title}</h1>
                  {formData.thumbnail && (
                    <img
                      src={formData.thumbnail}
                      alt={formData.title}
                      className="w-full h-64 object-cover rounded-sm mb-6"
                    />
                  )}
                  <div className="whitespace-pre-wrap">{formData.content}</div>
                </article>

                <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200">
                  <Button onClick={() => setPreview(false)} variant="outline">
                    Quay lại chỉnh sửa
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
