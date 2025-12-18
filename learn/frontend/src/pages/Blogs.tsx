import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Tag, Calendar, User, ArrowRight, Bookmark, Heart, Share2, MessageCircle, PlusCircle, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { fadeIn, staggerContainer } from "@/utils/animations";

interface Blog {
  id: number;
  title: string;
  content: string;
  thumbnail?: string;
  user_name: string;
  created_at: string;
  is_saved?: boolean;
  category?: string; // Assuming we might have categories later
  readTime?: number; // Assuming we calculate read time
}

export default function Blogs() {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [filteredBlogs, setFilteredBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchBlogs();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredBlogs(blogs);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredBlogs(blogs.filter(blog =>
        blog.title.toLowerCase().includes(query) ||
        blog.content.toLowerCase().includes(query) ||
        blog.user_name.toLowerCase().includes(query)
      ));
    }
  }, [searchQuery, blogs]);

  const fetchBlogs = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers: any = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch("http://127.0.0.1:3000/api/blogs", {
        headers,
      });
      const data = await response.json();
      if (data.success) {
        const blogsWithMeta = data.data.map((blog: any) => ({
          ...blog,
          readTime: Math.ceil(blog.content.length / 1000) || 1, // Rough estimate
          category: "Technology" // Placeholder category
        })) || [];
        setBlogs(blogsWithMeta);
        setFilteredBlogs(blogsWithMeta);
      }
    } catch (error) {
      console.error("Error fetching blogs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (blogId: number, isSaved: boolean) => {
    if (!isAuthenticated) {
      toast({
        title: "Vui lòng đăng nhập",
        description: "Bạn cần đăng nhập để lưu blog",
        variant: "destructive",
      });
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `http://127.0.0.1:3000/api/blogs/${blogId}/save`,
        {
          method: isSaved ? "DELETE" : "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        toast({
          title: isSaved ? "Đã bỏ lưu" : "Đã lưu",
          description: isSaved
            ? "Blog đã được xóa khỏi danh sách lưu"
            : "Blog đã được lưu",
        });
        fetchBlogs();
      }
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Có lỗi xảy ra",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-screen">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 font-medium animate-pulse">Đang tải bài viết...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const featuredBlog = blogs.length > 0 ? blogs[0] : null;
  const otherBlogs = blogs.length > 0 ? filteredBlogs.slice(1) : [];

  return (
    <Layout>
      <div className="bg-gray-50 min-h-screen pb-20">
        {/* Header Section */}
        <div className="bg-white border-b border-gray-100 sticky top-16 z-30 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
              {["Tất cả", "Technology", "Design", "Productivity", "AI", "Business"].map((tag, idx) => (
                <Button
                  key={idx}
                  variant={idx === 0 ? "default" : "outline"}
                  size="sm"
                  className={`rounded-full ${idx === 0 ? "bg-black text-white hover:bg-gray-800" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                >
                  {tag}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Tìm kiếm bài viết..."
                  className="pl-9 h-9 bg-gray-50 border-gray-200 focus:ring-1 focus:ring-black rounded-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              {isAuthenticated && (
                <Link to="/blogs/create">
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4">
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Viết bài
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8 space-y-12">

          {/* Featured Post */}
          {featuredBlog && !searchQuery && (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeIn}
              className="group cursor-pointer"
            >
              <Link to={`/blogs/${featuredBlog.id}`} className="block">
                <div className="grid md:grid-cols-12 gap-6 items-center">
                  <div className="md:col-span-8 overflow-hidden rounded-2xl shadow-lg relative aspect-[16/9] md:aspect-[21/9]">
                    <img
                      src={featuredBlog.thumbnail || "https://images.unsplash.com/photo-1499750310159-5b5f0969755b?q=80&w=2070&auto=format&fit=crop"}
                      alt={featuredBlog.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute top-4 left-4">
                      <Badge className="bg-white/90 text-black backdrop-blur-sm hover:bg-white text-xs font-bold uppercase tracking-wider px-3 py-1">Featured</Badge>
                    </div>
                  </div>
                  <div className="md:col-span-4 space-y-4">
                    <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      <span>Top Trending</span>
                      <span className="w-1 h-1 bg-gray-300 rounded-full" />
                      <span>{featuredBlog.readTime} min read</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight group-hover:text-blue-600 transition-colors">
                      {featuredBlog.title}
                    </h1>
                    <p className="text-gray-600 text-lg line-clamp-3">
                      {featuredBlog.content.substring(0, 150)}...
                    </p>
                    <div className="flex items-center gap-3 pt-2">
                      <div className="w-10 h-10 bg-gradient-to-tr from-orange-400 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                        {featuredBlog.user_name.charAt(0)}
                      </div>
                      <div className="text-sm">
                        <p className="font-semibold text-gray-900">{featuredBlog.user_name}</p>
                        <p className="text-gray-500">{new Date(featuredBlog.created_at).toLocaleDateString("vi-VN")}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          )}

          {/* Main Grid */}
          <div>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                {searchQuery ? `Kết quả cho "${searchQuery}"` : "Mới nhất"}
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </h2>
            </div>

            {filteredBlogs.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
                <div className="mb-4">
                  <Search className="w-12 h-12 text-gray-300 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">Không tìm thấy bài viết nào</h3>
                <p className="text-gray-500">Thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc</p>
              </div>
            ) : (
              <motion.div
                initial="hidden"
                animate="visible"
                variants={staggerContainer}
                className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
              >
                {searchQuery ? filteredBlogs.map((blog) => (
                  <BlogCard key={blog.id} blog={blog} isAuthenticated={isAuthenticated} handleSave={handleSave} />
                )) : otherBlogs.map((blog) => (
                  <BlogCard key={blog.id} blog={blog} isAuthenticated={isAuthenticated} handleSave={handleSave} />
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

const BlogCard = ({ blog, isAuthenticated, handleSave }: { blog: Blog, isAuthenticated: boolean, handleSave: Function }) => (
  <motion.div
    variants={fadeIn}
    className="group flex flex-col h-full"
  >
    <div className="relative overflow-hidden rounded-xl aspect-[3/2] mb-4">
      <Link to={`/blogs/${blog.id}`}>
        <img
          src={blog.thumbnail || `https://source.unsplash.com/random/800x600?sig=${blog.id}`}
          alt={blog.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1432821596592-e2c18b78144f?w=800&auto=format&fit=crop&q=60";
          }}
        />
      </Link>
      <div className="absolute top-3 right-3 flex gap-2">
        {isAuthenticated && (
          <button
            onClick={(e) => {
              e.preventDefault();
              handleSave(blog.id, blog.is_saved || false);
            }}
            className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-all ${blog.is_saved ? "bg-blue-600 text-white" : "bg-white/30 text-white hover:bg-white/50"}`}
          >
            <Bookmark className={`w-4 h-4 ${blog.is_saved ? "fill-current" : ""}`} />
          </button>
        )}
      </div>
    </div>

    <div className="flex-1 flex flex-col">
      <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 mb-2 uppercase tracking-wide">
        <span>Article</span>
        <span>•</span>
        <span>{blog.readTime} min read</span>
      </div>
      <Link to={`/blogs/${blog.id}`} className="block flex-1 group-hover:text-blue-600 transition-colors">
        <h3 className="text-xl font-bold text-gray-900 mb-2 leading-snug line-clamp-2">
          {blog.title}
        </h3>
        <p className="text-gray-600 text-sm line-clamp-2 mb-4">
          {blog.content.substring(0, 100)}...
        </p>
      </Link>

      <div className="flex items-center gap-3 mt-auto pt-4 border-t border-gray-100">
        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-500">
          {blog.user_name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{blog.user_name}</p>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Calendar className="w-3 h-3" />
            <span>{new Date(blog.created_at).toLocaleDateString("vi-VN")}</span>
          </div>
        </div>
      </div>
    </div>
  </motion.div>
)
