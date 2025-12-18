import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Trash2, ShoppingCart, ArrowRight, ShieldCheck, Ticket } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";

interface CartItem {
  id: number;
  course_id: number;
  title_en: string;
  title_vi: string;
  thumbnail: string;
  price: number;
  instructor_name: string;
}

export default function Cart() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCart();
  }, []);

  const fetchCart = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch("http://127.0.0.1:3000/api/cart", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setCartItems(data.data);
      }
    } catch (error) {
      console.error("Error fetching cart:", error);
    } finally {
      setLoading(false);
    }
  };

  const removeFromCart = async (cartId: number) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`http://127.0.0.1:3000/api/cart/${cartId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: "Đã xóa khỏi giỏ hàng",
          description: "Khóa học đã được xóa khỏi giỏ hàng",
        });
        fetchCart();
      }
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể xóa khóa học",
        variant: "destructive",
      });
    }
  };

  const totalPrice = cartItems.reduce((sum, item) => sum + item.price, 0);

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      toast({
        title: "Giỏ hàng trống",
        description: "Vui lòng thêm khóa học vào giỏ hàng",
        variant: "destructive",
      });
      return;
    }
    navigate("/checkout");
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-screen bg-gray-50/30">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50/30 py-12">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Giỏ hàng</h1>
              <p className="text-gray-500 font-medium">{cartItems.length} khóa học trong giỏ hàng</p>
            </div>
          </div>

          {cartItems.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl border border-dashed border-gray-200 p-16 text-center max-w-2xl mx-auto"
            >
              <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShoppingCart className="w-10 h-10 text-blue-200" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Giỏ hàng của bạn đang trống
              </h3>
              <p className="text-gray-500 mb-8 max-w-md mx-auto">
                Có vẻ như bạn chưa chọn khóa học nào. Hãy khám phá hàng nghìn khóa học chất lượng cao của chúng tôi.
              </p>
              <Button
                onClick={() => navigate("/courses")}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 px-8 rounded-full shadow-lg shadow-blue-200 transition-all hover:scale-105"
              >
                Khám phá ngay
              </Button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Cart Items List */}
              <div className="lg:col-span-2 space-y-4">
                {cartItems.map((item, index) => (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    key={item.id}
                    className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-5 hover:shadow-lg transition-all duration-300 group"
                  >
                    <div className="w-36 h-28 shrink-0 rounded-xl overflow-hidden bg-gray-100 relative">
                      <img
                        src={item.thumbnail}
                        alt={item.title_vi}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    </div>

                    <div className="flex-1 flex flex-col justify-between py-1">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="font-bold text-lg text-gray-900 leading-snug group-hover:text-blue-600 transition-colors line-clamp-2">
                            {item.title_vi || item.title_en}
                          </h3>
                        </div>
                        <p className="text-sm text-gray-500 font-medium mt-1">
                          {item.instructor_name}
                        </p>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <div className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                          Truy cập trọn đời
                        </div>
                        <div className="text-xl font-bold text-blue-600">
                          {item.price === 0
                            ? "Miễn phí"
                            : new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(item.price)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col justify-center border-l border-gray-50 pl-4 ml-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFromCart(item.id)}
                        className="text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full h-10 w-10 transition-colors"
                        title="Xóa khỏi giỏ hàng"
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Order Summary - Sticky */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden sticky top-24">
                  <div className="p-6 pb-4 border-b border-gray-50">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Ticket className="w-5 h-5 text-blue-600" />
                      Tóm tắt đơn hàng
                    </h3>
                  </div>

                  <div className="p-6 pt-4 space-y-6">
                    <div className="space-y-3">
                      <div className="flex justify-between text-gray-600">
                        <span>Tạm tính</span>
                        <span className="font-medium text-gray-900">{totalPrice.toLocaleString("vi-VN")} đ</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Giảm giá</span>
                        <span className="text-green-600 font-medium">-0 đ</span>
                      </div>
                    </div>

                    <Separator className="bg-gray-100" />

                    <div className="flex justify-between items-end">
                      <span className="text-gray-900 font-bold text-lg">Tổng cộng</span>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-blue-600 block leading-none">
                          {totalPrice.toLocaleString("vi-VN")} đ
                        </span>
                        <span className="text-xs text-gray-400 font-normal mt-1 block">Đã bao gồm VAT</span>
                      </div>
                    </div>

                    <Button
                      onClick={handleCheckout}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-14 rounded-xl shadow-lg shadow-blue-200 transition-all hover:translate-y-[-2px] active:translate-y-0"
                    >
                      Tiến hành thanh toán
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>

                    <div className="flex items-center justify-center gap-2 text-xs text-gray-400 bg-gray-50 p-3 rounded-lg">
                      <ShieldCheck className="w-4 h-4 text-green-500" />
                      <span>Thanh toán an toàn & bảo mật</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
