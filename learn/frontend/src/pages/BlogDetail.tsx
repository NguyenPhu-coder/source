import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Layout from "../components/Layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Bookmark, ArrowLeft, Edit, Calendar, Clock, Share2, MessageCircle, Heart, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import { fadeIn, slideUp } from "@/utils/animations";

interface Blog {
  id: number;
  user_id: number;
  title: string;
  content: string;
  thumbnail?: string;
  user_name: string;
  user_email: string;
  created_at: string;
  updated_at: string;
  is_saved?: boolean;
}

export default function BlogDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [blog, setBlog] = useState<Blog | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchBlog();
  }, [id]);

  const fetchBlog = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers: any = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`http://127.0.0.1:3000/api/blogs/${id}`, {
        headers,
      });
      const data = await response.json();

      if (data.success) {
        setBlog(data.data);
      } else {
        toast({
          title: "Lỗi",
          description: "Không tìm thấy blog",
          variant: "destructive",
        });
        navigate("/blogs");
      }
    } catch (error) {
      console.error("Error fetching blog:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
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
        `http://127.0.0.1:3000/api/blogs/${id}/save`,
        {
          method: blog?.is_saved ? "DELETE" : "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        setBlog(prev => prev ? ({ ...prev, is_saved: !prev.is_saved }) : null);
        toast({
          title: blog?.is_saved ? "Đã bỏ lưu" : "Đã lưu",
          description: blog?.is_saved
            ? "Blog đã được xóa khỏi danh sách lưu"
            : "Blog đã được lưu",
        });
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
          <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  if (!blog) return null;

  const isAuthor = user?.id === blog.user_id;

  return (
    <Layout>
      <article className="min-h-screen bg-white pb-20">
        {/* Progress Bar (Optional - could be added with scroll listener) */}

        {/* Header / Hero */}
        <div className="bg-gray-50 border-b border-gray-100 py-12 md:py-20">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={slideUp}
            className="max-w-3xl mx-auto px-4 text-center space-y-6"
          >
            <div className="flex items-center justify-center gap-2 mb-6">
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200">Technology</Badge>
              <span className="text-gray-400">•</span>
              <span className="text-gray-500 text-sm font-medium">5 min read</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight tracking-tight">
              {blog.title}
            </h1>

            <div className="flex items-center justify-center gap-6 pt-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                  <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${blog.user_name}`} />
                  <AvatarFallback>{blog.user_name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <p className="font-bold text-gray-900 text-sm">{blog.user_name}</p>
                  <p className="text-blue-600 text-xs font-medium">Author</p>
                </div>
              </div>
              <Separator orientation="vertical" className="h-8" />
              <div className="text-left text-sm text-gray-500">
                <p>{new Date(blog.created_at).toLocaleDateString("en-US", { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                <p>{new Date(blog.created_at).toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Cover Image */}
        {blog.thumbnail && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="max-w-5xl mx-auto px-4 -mt-10 mb-12"
          >
            <div className="rounded-2xl overflow-hidden shadow-2xl aspect-[21/9]">
              <img
                src={blog.thumbnail}
                alt={blog.title}
                className="w-full h-full object-cover"
              />
            </div>
          </motion.div>
        )}

        {/* Content & Sidebar */}
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-12 gap-12">

          {/* Social Share (Left Sticky) */}
          <div className="hidden lg:block col-span-2">
            <div className="sticky top-32 flex flex-col gap-4 items-end">
              <Button variant="outline" size="icon" className="rounded-full w-10 h-10 border-gray-200 hover:border-gray-900 hover:bg-gray-50 transition-colors" onClick={handleSave}>
                <Bookmark className={`w-4 h-4 ${blog.is_saved ? "fill-current" : ""}`} />
              </Button>
              <Button variant="outline" size="icon" className="rounded-full w-10 h-10 border-gray-200 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 transition-colors">
                <Share2 className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" className="rounded-full w-10 h-10 border-gray-200 hover:border-red-500 hover:text-red-500 hover:bg-red-50 transition-colors">
                <Heart className="w-4 h-4" />
              </Button>
              <span className="text-sm font-bold text-gray-400 mt-2">1.2k</span>
            </div>
          </div>

          {/* Main Content */}
          <div className="col-span-1 lg:col-span-7">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
              className="prose prose-lg prose-blue max-w-none text-gray-800 leading-relaxed font-serif"
            >
              {/* Render content paragraphs */}
              {blog.content.split('\n').map((paragraph, index) => (
                <p key={index} className="mb-6">{paragraph}</p>
              ))}
            </motion.div>

            <div className="mt-12 pt-8 border-t border-gray-100 flex flex-wrap gap-2">
              {["Learning", "Education", "Development"].map(tag => (
                <Badge key={tag} variant="secondary" className="bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer">#{tag}</Badge>
              ))}
            </div>

            {/* Author Bio Box */}
            <div className="mt-12 p-8 bg-gray-50 rounded-2xl flex gap-6 items-start">
              <Avatar className="h-16 w-16">
                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${blog.user_name}`} />
                <AvatarFallback>{blog.user_name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Written by {blog.user_name}</h3>
                <p className="text-gray-600 mb-4">Passionate educator and technology enthusiast. Sharing insights about web development and modern software architecture.</p>
                <Button variant="outline" size="sm">Follow Author</Button>
              </div>
            </div>

            {/* Comments Section Placeholder */}
            <div className="mt-12">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Comments (3)</h3>
              <div className="bg-gray-50 p-6 rounded-xl text-center">
                <MessageCircle className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                <p className="text-gray-500 mb-4">Join the conversation</p>
                <Button>Sign in to Comment</Button>
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="col-span-1 lg:col-span-3 space-y-8">
            {isAuthor && (
              <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                <h4 className="font-bold text-blue-900 mb-2">Admin Controls</h4>
                <p className="text-sm text-blue-700 mb-4">Manage this post settings</p>
                <Button className="w-full bg-blue-600 hover:bg-blue-700 mb-2" onClick={() => navigate(`/blogs/edit/${blog.id}`)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Post
                </Button>
                <Button variant="outline" className="w-full border-blue-200 text-blue-700 hover:bg-blue-100">
                  View Stats
                </Button>
              </div>
            )}

            <div className="sticky top-32">
              <h4 className="font-bold text-gray-900 mb-4 uppercase text-sm tracking-wider">Related Posts</h4>
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="group cursor-pointer">
                    <div className="aspect-video bg-gray-200 rounded-lg mb-3 overflow-hidden">
                      <img src={`https://source.unsplash.com/random/400x300?sig=${i}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    </div>
                    <h5 className="font-bold text-gray-900 leading-tight group-hover:text-blue-600 transition-colors">
                      Why you should learn React in 2025
                    </h5>
                    <p className="text-xs text-gray-500 mt-1">4 min read</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Floating Action Bar (Mobile) */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 lg:hidden z-50">
          <div className="bg-white/80 backdrop-blur-lg border border-gray-200 shadow-xl rounded-full px-6 py-3 flex items-center gap-6">
            <button onClick={handleSave} className={`${blog.is_saved ? "text-blue-600" : "text-gray-600"}`}>
              <Bookmark className={`w-5 h-5 ${blog.is_saved ? "fill-current" : ""}`} />
            </button>
            <Separator orientation="vertical" className="h-4" />
            <button className="text-gray-600 hover:text-blue-600"><Share2 className="w-5 h-5" /></button>
            <Separator orientation="vertical" className="h-4" />
            <button className="text-gray-600 hover:text-red-600"><Heart className="w-5 h-5" /></button>
          </div>
        </div>

      </article>
    </Layout>
  );
}
