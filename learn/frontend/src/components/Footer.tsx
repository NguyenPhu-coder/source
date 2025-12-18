import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Facebook, Twitter, Linkedin, Instagram, Mail, Phone, MapPin } from "lucide-react";

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="bg-foreground text-secondary border-t border-border/10 pt-16 pb-8">
      <div className="container mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-500/20">
                L
              </div>
              <span className="font-bold text-2xl text-white tracking-tight">
                LearnHub
              </span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed max-w-xs">
              Nền tảng học tập trực tuyến hàng đầu, kết nối tri thức và tương lai của bạn. Học bất cứ đâu, bất cứ lúc nào.
            </p>
            <div className="flex gap-4 pt-2">
              {[Facebook, Twitter, Linkedin, Instagram].map((Icon, i) => (
                <a key={i} href="#" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary hover:text-white transition-all duration-300">
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-bold text-white mb-6">Khám phá</h4>
            <ul className="space-y-3 text-sm text-gray-400">
              <li><Link to="/courses" className="hover:text-primary transition-colors flex items-center gap-2">Khóa học mới nhất</Link></li>
              <li><Link to="/categories" className="hover:text-primary transition-colors flex items-center gap-2">Chủ đề phổ biến</Link></li>
              <li><Link to="/blogs" className="hover:text-primary transition-colors flex items-center gap-2">Bài viết chia sẻ</Link></li>
              <li><Link to="/about" className="hover:text-primary transition-colors flex items-center gap-2">Về chúng tôi</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-bold text-white mb-6">Hỗ trợ</h4>
            <ul className="space-y-3 text-sm text-gray-400">
              <li><Link to="/contact" className="hover:text-primary transition-colors">Trung tâm trợ giúp</Link></li>
              <li><Link to="/sitemap" className="hover:text-primary transition-colors">Sơ đồ trang web</Link></li>
              <li><Link to="/faq" className="hover:text-primary transition-colors">Câu hỏi thường gặp</Link></li>
              <li><Link to="/terms" className="hover:text-primary transition-colors">Điều khoản sử dụng</Link></li>
              <li><Link to="/privacy" className="hover:text-primary transition-colors">Chính sách bảo mật</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold text-white mb-6">Liên hệ</h4>
            <ul className="space-y-4 text-sm text-gray-400">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-primary shrink-0" />
                <span>Tòa nhà TechHub, 123 Đường ABC, Quận 1, TP.HCM</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-primary shrink-0" />
                <span>+84 123 456 789</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-primary shrink-0" />
                <span>contact@learnhub.com</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
          <p>© 2024 LearnHub. All rights reserved.</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <span>English</span>
            <span>Tiếng Việt</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
