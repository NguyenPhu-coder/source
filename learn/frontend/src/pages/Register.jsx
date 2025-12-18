import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Lock, User, AlertCircle, ArrowRight, ShieldCheck, Star, Users } from "lucide-react";
import { motion } from "framer-motion";

export default function Register() {
  const { t } = useLanguage();
  const { register: registerUser, googleLogin } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm();

  const password = watch("password");

  const onSubmit = async (data) => {
    setError("");
    setLoading(true);

    const result = await registerUser(data.name, data.email, data.password);

    if (!result.success) {
      setError(result.error || t("auth.registerError"));
    }
    // Navigation usually handled by AuthContext
    setLoading(false);
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError("");
    setLoading(true);

    const result = await googleLogin(credentialResponse);

    if (!result.success) {
      setError(result.error || t("auth.googleLoginError"));
    }
    setLoading(false);
  };

  const handleGoogleError = () => {
    setError(t("auth.googleLoginError"));
  };

  return (
    <div className="min-h-screen w-full flex bg-white overflow-hidden">
      {/* Right Side - Visual (Swapped for Register to alternate layout) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="hidden lg:flex lg:w-1/2 relative bg-[#0f0c29] overflow-hidden items-center justify-center p-12 order-2"
      >
        {/* Background Gradients */}
        <div className="absolute inset-0 bg-gradient-to-bl from-[#1a1444] via-[#302b63] to-[#0f0c29] opacity-90" />
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-pink-500/20 rounded-full blur-[120px] -translate-x-1/3 -translate-y-1/4" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[100px] translate-x-1/3 translate-y-1/4" />

        {/* Content */}
        <div className="relative z-10 text-white max-w-lg">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-8"
          >
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold mb-4">Gia nhập cộng đồng</h2>
              <p className="text-blue-200 text-lg">Học tập và phát triển cùng hàng triệu thành viên khác</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/5">
                <Users className="w-8 h-8 text-blue-400 mb-3" />
                <span className="block text-2xl font-bold">100K+</span>
                <span className="text-sm text-blue-200">Học viên tích cực</span>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/5">
                <Star className="w-8 h-8 text-yellow-400 mb-3" />
                <span className="block text-2xl font-bold">4.9/5</span>
                <span className="text-sm text-blue-200">Đánh giá khóa học</span>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/5">
                <ShieldCheck className="w-8 h-8 text-green-400 mb-3" />
                <span className="block text-2xl font-bold">100%</span>
                <span className="text-sm text-blue-200">Uy tín & Chất lượng</span>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/5">
                <ArrowRight className="w-8 h-8 text-purple-400 mb-3" />
                <span className="block text-2xl font-bold">24/7</span>
                <span className="text-sm text-blue-200">Hỗ trợ trọn đời</span>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Left Side - Form */}
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full lg:w-1/2 flex flex-col justify-center p-8 lg:p-16 xl:p-24 relative z-10 order-1"
      >
        <div className="max-w-md mx-auto w-full space-y-6">
          <div className="space-y-2">
            <Link to="/" className="inline-block">
              <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                E-Learning
              </span>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              Tạo tài khoản mới
            </h1>
            <p className="text-gray-500">
              Bắt đầu hành trình học tập của bạn ngay hôm nay
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="animate-shake">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Họ và tên</Label>
              <div className="relative group">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Nguyễn Văn A"
                  {...register("name", {
                    required: "Vui lòng nhập họ tên",
                    minLength: {
                      value: 2,
                      message: "Tên phải có ít nhất 2 ký tự",
                    },
                  })}
                  className="pl-10 h-11 bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 transition-all"
                />
              </div>
              {errors.name && (
                <span className="text-xs text-red-500">{errors.name.message}</span>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  {...register("email", {
                    required: "Vui lòng nhập email",
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: "Email không hợp lệ",
                    },
                  })}
                  className="pl-10 h-11 bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 transition-all"
                />
              </div>
              {errors.email && (
                <span className="text-xs text-red-500">{errors.email.message}</span>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  {...register("password", {
                    required: "Vui lòng nhập mật khẩu",
                    minLength: {
                      value: 6,
                      message: "Mật khẩu phải từ 6 ký tự",
                    },
                  })}
                  className="pl-10 h-11 bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 transition-all"
                />
              </div>
              {errors.password && (
                <span className="text-xs text-red-500">{errors.password.message}</span>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Nhập lại mật khẩu</Label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  {...register("confirmPassword", {
                    required: "Vui lòng xác nhận mật khẩu",
                    validate: (value) =>
                      value === password || "Mật khẩu không khớp",
                  })}
                  className="pl-10 h-11 bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 transition-all"
                />
              </div>
              {errors.confirmPassword && (
                <span className="text-xs text-red-500">{errors.confirmPassword.message}</span>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-11 mt-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02]"
              disabled={loading}
            >
              {loading ? "Đang tạo tài khoản..." : "Đăng ký miễn phí"}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-4 text-gray-500">
                Hoặc đăng ký bằng
              </span>
            </div>
          </div>

          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              text="signup_with"
              shape="pill"
              width="380"
            />
          </div>

          <p className="text-center text-gray-600">
            Đã có tài khoản?{" "}
            <Link
              to="/login"
              className="text-blue-600 font-bold hover:text-blue-700 hover:underline"
            >
              Đăng nhập ngay
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
