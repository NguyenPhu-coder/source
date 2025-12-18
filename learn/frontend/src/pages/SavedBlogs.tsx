import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Bookmark, Eye } from "lucide-react";

interface Blog {
  id: number;
  title: string;
  content: string;
  thumbnail?: string;
  user_name: string;
  created_at: string;
  is_saved: boolean;
}

export default function SavedBlogs() {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchSavedBlogs();
  }, []);

  const fetchSavedBlogs = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        "http://127.0.0.1:3000/api/blogs/user/saved",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        setBlogs(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching saved blogs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnsave = async (id: number) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `http://127.0.0.1:3000/api/blogs/${id}/save`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        toast({
          title: "Đã bỏ lưu",
          description: "Blog đã được xóa khỏi danh sách lưu",
        });
        fetchSavedBlogs();
      }
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể bỏ lưu blog",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Đang tải...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Bài viết đã lưu</h1>
          <p className="text-gray-600 mt-1">
            Các bài blog bạn đã đánh dấu để đọc sau
          </p>
        </div>

        {blogs.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-sm p-12 text-center">
            <Bookmark className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">Chưa có blog nào được lưu</p>
            <Link to="/blogs">
              <Button>Khám phá blog</Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-6">
            {blogs.map((blog) => (
              <div
                key={blog.id}
                className="bg-white border border-gray-200 rounded-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="flex gap-4 p-6">
                  {blog.thumbnail && (
                    <img
                      src={blog.thumbnail}
                      alt={blog.title}
                      className="w-48 h-32 object-cover rounded-sm flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h2 className="text-xl font-bold text-gray-900 mb-2">
                          {blog.title}
                        </h2>
                        <p className="text-gray-600 line-clamp-2 mb-3">
                          {blog.content.substring(0, 200)}...
                        </p>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>Tác giả: {blog.user_name}</span>
                          <span>•</span>
                          <span>
                            {new Date(blog.created_at).toLocaleDateString(
                              "vi-VN"
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Link to={`/blogs/${blog.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="w-4 h-4 mr-1" />
                            Xem
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUnsave(blog.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Bookmark className="w-4 h-4 mr-1 fill-current" />
                          Bỏ lưu
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
