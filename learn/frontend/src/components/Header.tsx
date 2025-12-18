import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import NotificationBell from "@/components/NotificationBell";
import {
  Menu,
  X,
  LogOut,
  User as UserIcon,
  ChevronDown,
  Search,
  LayoutDashboard,
  Wallet,
  ShoppingCart,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const { user, logout, isAuthenticated } = useAuth() as any;
  const navigate = useNavigate();

  // Fetch cart count
  useEffect(() => {
    if (isAuthenticated) {
      fetchCartCount();
    }
  }, [isAuthenticated]);

  const fetchCartCount = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://127.0.0.1:3000/api/cart", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setCartCount(data.data.length);
      }
    } catch (error) {
      console.error("Error fetching cart:", error);
    }
  };

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
      setSearchTerm("");
    }
  };

  return (
    <motion.header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
        ? "bg-white shadow-md py-2"
        : "bg-transparent py-4"
        }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="container mx-auto px-6 md:px-12">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xl shadow-lg transition-all duration-300 ${scrolled ? 'bg-primary text-white' : 'bg-white text-primary'}`}>
              L
            </div>
            <span className={`hidden sm:inline text-xl font-bold transition-colors ${scrolled ? 'text-foreground' : 'text-foreground/90'}`}>
              LearnHub
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            {/* AI Lab Dropdown - New Feature */}
            <div className="relative group">
              <button
                className="flex items-center gap-1 font-medium hover:text-primary transition-colors py-2"
              >
                <div className="flex items-center gap-1 text-primary font-bold">
                  <span>🤖</span> AI Lab
                </div>
                <ChevronDown className="w-4 h-4 transition-transform duration-300 group-hover:rotate-180" />
              </button>

              <div className="absolute left-0 mt-2 w-72 bg-white border border-gray-100 shadow-xl rounded-xl overflow-hidden invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 z-20">
                <div className="p-2">
                  <Link to="/ai-dashboard" className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors group/item">
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xl">
                      📊
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 group-hover/item:text-indigo-600 transition-colors">AI Dashboard</p>
                      <p className="text-xs text-gray-500">Trung tâm điều khiển học tập thông minh</p>
                    </div>
                  </Link>
                  <Link to="/analytics" className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors group/item">
                    <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xl">
                      📈
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 group-hover/item:text-green-600 transition-colors">Phân tích chuyên sâu</p>
                      <p className="text-xs text-gray-500">Theo dõi tiến độ với AI</p>
                    </div>
                  </Link>
                </div>
              </div>
            </div>

            {/* Categories Dropdown */}
            <div className="relative group">
              <button
                onClick={() => setCategoryMenuOpen(!categoryMenuOpen)}
                className="flex items-center gap-1 font-medium hover:text-primary transition-colors py-2"
              >
                Danh mục
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-300 ${categoryMenuOpen ? "rotate-180" : ""
                    }`}
                />
              </button>

              <AnimatePresence>
                {categoryMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute left-0 mt-2 w-64 bg-white border border-gray-100 shadow-xl rounded-xl overflow-hidden z-20"
                  >
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setCategoryMenuOpen(false)}
                    />
                    <div className="relative z-20 py-2">
                      {[
                        { id: 1, name: "Công nghệ" },
                        { id: 2, name: "Kinh doanh" },
                        { id: 3, name: "Thiết kế" },
                        { id: 4, name: "Marketing" },
                      ].map((cat) => (
                        <Link
                          key={cat.id}
                          to={`/categories?category=${cat.id}`}
                          onClick={() => setCategoryMenuOpen(false)}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors"
                        >
                          {cat.name}
                        </Link>
                      ))}
                      <div className="border-t border-gray-100 my-1" />
                      <Link
                        to="/categories"
                        onClick={() => setCategoryMenuOpen(false)}
                        className="block px-4 py-2.5 text-sm font-semibold text-primary hover:bg-gray-50 transition-colors"
                      >
                        Xem tất cả danh mục
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </nav>

          {/* Search Bar - Desktop */}
          <div className="hidden lg:block flex-1 max-w-xl mx-8">
            <form onSubmit={handleSearch} className="relative group">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm kiếm..."
                className="w-full px-4 py-2.5 pl-10 pr-4 bg-gray-100 border border-transparent focus:border-primary/50 focus:bg-white rounded-full focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all duration-300 shadow-inner"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-primary transition-colors" />
            </form>
          </div>

          {/* Right Side Actions */}
          <div className="hidden lg:flex items-center gap-4">
            {isAuthenticated ? (
              <>
                {/* Cart Icon */}
                <Link
                  to="/cart"
                  className="relative p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <ShoppingCart className="w-5 h-5" />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {cartCount}
                    </span>
                  )}
                </Link>

                <NotificationBell />

                {/* User Menu */}
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 focus:outline-none"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-md ring-2 ring-transparent hover:ring-primary/20 transition-all">
                      {user?.name?.charAt(0).toUpperCase()}
                    </div>
                  </button>

                  <AnimatePresence>
                    {userMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="absolute right-0 mt-4 w-72 bg-white border border-gray-100 shadow-xl rounded-xl overflow-hidden z-50 origin-top-right"
                      >
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setUserMenuOpen(false)}
                        />
                        <div className="relative z-20">
                          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                            <p className="font-semibold truncate text-gray-900">{user?.name}</p>
                            <p className="text-sm text-gray-500 truncate">{user?.email}</p>
                          </div>

                          <div className="py-2">
                            <Link to="/cart" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-6 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors">
                              <span>📦 Giỏ hàng</span>
                            </Link>
                            <Link to="/blogs/my-blogs" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-6 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors">
                              <span>✍️ Bài viết của tôi</span>
                            </Link>

                            {user?.role === "instructor" && (
                              <Link to="/instructor" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-6 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors">
                                <LayoutDashboard className="w-4 h-4" />
                                <span>Bảng điều khiển giảng viên</span>
                              </Link>
                            )}
                            {user?.role === "admin" && (
                              <Link to="/admin" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-6 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors">
                                <LayoutDashboard className="w-4 h-4" />
                                <span>Quản trị</span>
                              </Link>
                            )}

                            <Link to="/my-learning" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-6 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors">
                              <UserIcon className="w-4 h-4" />
                              <span>Khóa học của tôi</span>
                            </Link>

                            <Link to="/profile" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-6 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors">
                              <span>👤 Hồ sơ cá nhân</span>
                            </Link>

                            <Link to="/settings" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-6 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors">
                              <span>⚙️ Cài đặt</span>
                            </Link>

                            <Link to="/wallet" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-6 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors">
                              <Wallet className="w-4 h-4" />
                              <span>Ví của tôi</span>
                            </Link>
                          </div>

                          <div className="border-t border-gray-100 py-2 bg-gray-50">
                            <button
                              onClick={() => {
                                logout();
                                setUserMenuOpen(false);
                              }}
                              className="flex items-center gap-3 px-6 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left transition-colors"
                            >
                              <LogOut className="w-4 h-4" />
                              <span>Đăng xuất</span>
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium hover:text-primary transition-colors"
                >
                  Đăng nhập
                </Link>
                <Link to="/register">
                  <Button className="bg-primary hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20 rounded-full px-6">
                    Đăng ký
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.nav
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden overflow-hidden bg-white border-t border-gray-100"
            >
              <div className="px-6 py-6 space-y-4">
                <form onSubmit={handleSearch} className="mb-6">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Tìm kiếm..."
                      className="w-full px-4 py-3 pl-10 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  </div>
                </form>

                <div className="space-y-2">
                  <Link to="/courses" className="block px-4 py-3 rounded-lg hover:bg-gray-50 font-medium" onClick={() => setMobileMenuOpen(false)}>Khóa học</Link>
                  <Link to="/categories" className="block px-4 py-3 rounded-lg hover:bg-gray-50 font-medium" onClick={() => setMobileMenuOpen(false)}>Danh mục</Link>
                  <div className="border-t border-gray-100 my-2 pt-2">
                    <p className="px-4 text-xs font-bold text-gray-500 uppercase mb-1">AI Features</p>
                    <Link to="/ai-dashboard" className="block px-4 py-3 rounded-lg hover:bg-indigo-50 font-medium text-indigo-600 flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                      <span>🤖</span> AI Dashboard
                    </Link>
                    <Link to="/analytics" className="block px-4 py-3 rounded-lg hover:bg-gray-50 font-medium flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                      <span>📈</span> Analytics
                    </Link>
                  </div>
                  {isAuthenticated && (
                    <>
                      <Link to="/my-learning" className="block px-4 py-3 rounded-lg hover:bg-gray-50 font-medium" onClick={() => setMobileMenuOpen(false)}>Hồ sơ của tôi</Link>
                      <button onClick={logout} className="block w-full text-left px-4 py-3 rounded-lg hover:bg-red-50 text-red-600 font-medium">Đăng xuất</button>
                    </>
                  )}
                  {!isAuthenticated && (
                    <div className="grid grid-cols-2 gap-4 mt-6">
                      <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center px-4 py-3 rounded-xl border border-gray-200 font-bold">
                        Đăng nhập
                      </Link>
                      <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center px-4 py-3 rounded-xl bg-primary text-white font-bold shadow-lg shadow-blue-500/20">
                        Đăng ký
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}
