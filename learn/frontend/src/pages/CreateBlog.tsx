import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileText, Eye } from "lucide-react";

export default function CreateBlog() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    thumbnail: "",
    status: "draft" as "draft" | "published",
  });
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState(false);

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

      const response = await fetch("http://127.0.0.1:3000/api/blogs", {
        method: "POST",
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
          description:
            status === "published" ? "Đã xuất bản blog" : "Đã lưu bản nháp",
        });
        navigate("/blogs/my-blogs");
      } else {
        toast({
          title: "Lỗi",
          description: data.message || "Không thể tạo blog",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Có lỗi xảy ra khi tạo blog",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white border border-gray-200 rounded-sm shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <p className="text-gray-600">
              Chia sẻ kiến thức của bạn với cộng đồng
            </p>
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Nhập tiêu đề blog..."
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    placeholder="Viết nội dung blog của bạn... (hỗ trợ Markdown)"
                    required
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPreview(true)}
                    className="flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    Xem trước
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={(e) => handleSubmit(e as any, "draft")}
                    disabled={submitting}
                  >
                    Lưu nháp
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Đang xuất bản..." : "Xuất bản"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/blogs")}
                  >
                    Hủy
                  </Button>
                </div>
              </form>
            ) : (
              <div>
                <div className="mb-4">
                  <Button
                    variant="outline"
                    onClick={() => setPreview(false)}
                    size="sm"
                  >
                    ← Quay lại chỉnh sửa
                  </Button>
                </div>

                {/* Preview */}
                <article className="prose max-w-none">
                  <h1>{formData.title || "Tiêu đề"}</h1>
                  {formData.thumbnail && (
                    <img
                      src={formData.thumbnail}
                      alt={formData.title}
                      className="w-full h-64 object-cover rounded-sm"
                    />
                  )}
                  <div className="whitespace-pre-wrap">{formData.content}</div>
                </article>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
