import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  Wallet,
  Building2,
  Tag,
  User,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CartItem {
  id: number;
  course_id: number;
  title_vi: string;
  title_en: string;
  thumbnail: string;
  price: number;
}

interface CustomerInfo {
  fullName: string;
  email: string;
  phone: string;
  address: string;
}

interface CouponData {
  couponId: number;
  code: string;
  description: string;
  discountAmount: number;
  finalAmount: number;
}

export default function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>("vnpay");
  const [couponCode, setCouponCode] = useState<string>("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponData | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    fullName: "",
    email: "",
    phone: "",
    address: "",
  });

  useEffect(() => {
    const courseId = searchParams.get("courseId");
    if (courseId) {
      // Nếu có courseId, thêm vào giỏ hàng trước
      addCourseToCart(courseId);
    } else {
      fetchCart();
    }
    loadUserInfo();
  }, []);

  const addCourseToCart = async (courseId: string) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      const response = await fetch("http://127.0.0.1:3000/api/cart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          course_id: parseInt(courseId),
          quantity: 1,
        }),
      });

      const data = await response.json();

      if (response.ok || data.success) {
        // Sau khi thêm thành công, fetch cart
        fetchCart();
      } else {
        // Nếu đã có trong giỏ hoặc đã đăng ký, vẫn fetch cart để hiển thị
        if (data.message?.includes("already")) {
          fetchCart();
        } else {
          toast({
            title: "Lỗi",
            description: data.message || "Không thể thêm khóa học",
            variant: "destructive",
          });
          navigate("/courses");
        }
      }
    } catch (error) {
      console.error("Error adding to cart:", error);
      // Vẫn thử fetch cart để xem có gì không
      fetchCart();
    }
  };

  const loadUserInfo = () => {
    const user = localStorage.getItem("user");
    if (user) {
      const userData = JSON.parse(user);
      setCustomerInfo((prev) => ({
        ...prev,
        fullName: userData.name || "",
        email: userData.email || "",
      }));
    }
  };

  const fetchCart = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      if (!token) {
        toast({
          title: "Lỗi",
          description: "Vui lòng đăng nhập để xem giỏ hàng",
          variant: "destructive",
        });
        navigate("/login");
        return;
      }

      const response = await fetch("http://127.0.0.1:3000/api/cart", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      console.log("🛒 Cart data:", data);

      if (data.success) {
        setCartItems(data.data || []);
        if (!data.data || data.data.length === 0) {
          toast({
            title: "Thông báo",
            description: "Giỏ hàng trống. Đang chuyển về trang giỏ hàng...",
          });
          setTimeout(() => navigate("/cart"), 2000);
        }
      }
    } catch (error) {
      console.error("Error fetching cart:", error);
      toast({
        title: "Lỗi",
        description: "Không thể tải giỏ hàng",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const validateCoupon = async () => {
    if (!couponCode.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập mã giảm giá",
        variant: "destructive",
      });
      return;
    }

    setCouponLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        "http://127.0.0.1:3000/api/orders/validate-coupon",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            code: couponCode,
            orderAmount: totalPrice,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        setAppliedCoupon(data.data);
        toast({
          title: "Thành công",
          description: `Đã áp dụng mã giảm giá: ${data.data.description}`,
        });
      } else {
        toast({
          title: "Lỗi",
          description: data.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể kiểm tra mã giảm giá",
        variant: "destructive",
      });
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
  };

  const handleCheckout = async () => {
    // Check if cart is empty
    if (cartItems.length === 0) {
      toast({
        title: "Lỗi",
        description: "Giỏ hàng trống. Vui lòng thêm khóa học vào giỏ hàng",
        variant: "destructive",
      });
      navigate("/cart");
      return;
    }

    // Validate customer info
    if (!customerInfo.fullName || !customerInfo.email || !customerInfo.phone) {
      toast({
        title: "Lỗi",
        description: "Vui lòng điền đầy đủ thông tin khách hàng",
        variant: "destructive",
      });
      return;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerInfo.email)) {
      toast({
        title: "Lỗi",
        description: "Email không hợp lệ",
        variant: "destructive",
      });
      return;
    }

    // Validate phone
    const phoneRegex = /^[0-9]{10,11}$/;
    if (!phoneRegex.test(customerInfo.phone.replace(/\s/g, ""))) {
      toast({
        title: "Lỗi",
        description: "Số điện thoại không hợp lệ (10-11 số)",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      if (!token) {
        toast({
          title: "Lỗi",
          description: "Vui lòng đăng nhập để thanh toán",
          variant: "destructive",
        });
        navigate("/login");
        return;
      }

      const response = await fetch("http://127.0.0.1:3000/api/orders/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paymentMethod,
          customerInfo,
          couponCode: appliedCoupon?.code || null,
        }),
      });

      const data = await response.json();

      console.log("📦 Order creation response:", data);

      if (!response.ok) {
        if (response.status === 401) {
          toast({
            title: "Phiên đăng nhập hết hạn",
            description: "Vui lòng đăng nhập lại",
            variant: "destructive",
          });
          navigate("/login");
          return;
        }
        throw new Error(data.message || "Không thể tạo đơn hàng");
      }

      if (data.success) {
        console.log("✅ Order created successfully");
        console.log("🔗 Payment URL:", data.data?.paymentUrl);

        if (data.data?.paymentUrl) {
          console.log("🚀 Redirecting to payment URL...");
          window.location.href = data.data.paymentUrl;
        } else {
          toast({
            title: "Đặt hàng thành công",
            description: "Đơn hàng của bạn đã được xử lý",
          });
          navigate("/orders");
        }
      } else {
        toast({
          title: "Lỗi",
          description: data.message || "Không thể tạo đơn hàng",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể xử lý thanh toán",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const totalPrice = cartItems.reduce((sum, item) => sum + item.price, 0);
  const discountAmount = appliedCoupon?.discountAmount || 0;
  const finalPrice = appliedCoupon ? appliedCoupon.finalAmount : totalPrice;

  return (
    <Layout>
      {loading && cartItems.length === 0 ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
            <p className="text-gray-600">Đang tải giỏ hàng...</p>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 min-h-screen">
          <div className="border-b border-gray-200 bg-white/80 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 py-6">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Thanh toán
              </h1>
              <p className="text-gray-600 mt-2">
                Hoàn tất đơn hàng của bạn trong vài bước đơn giản
              </p>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Left - Customer Info & Payment Method */}
              <div className="lg:col-span-2 space-y-6">
                {/* Customer Information */}
                <div className="bg-white rounded-2xl shadow-lg p-6 border border-purple-100">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        Thông tin khách hàng
                      </h2>
                      <p className="text-sm text-gray-500">
                        Nhập thông tin để hoàn tất đơn hàng
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Họ và tên <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          value={customerInfo.fullName}
                          onChange={(e) =>
                            setCustomerInfo({
                              ...customerInfo,
                              fullName: e.target.value,
                            })
                          }
                          placeholder="Nguyễn Văn A"
                          className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Email <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                          <input
                            type="email"
                            value={customerInfo.email}
                            onChange={(e) =>
                              setCustomerInfo({
                                ...customerInfo,
                                email: e.target.value,
                              })
                            }
                            placeholder="email@example.com"
                            className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Số điện thoại <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                          <input
                            type="tel"
                            value={customerInfo.phone}
                            onChange={(e) =>
                              setCustomerInfo({
                                ...customerInfo,
                                phone: e.target.value,
                              })
                            }
                            placeholder="0987654321"
                            className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="bg-white rounded-2xl shadow-lg p-6 border border-purple-100">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        Phương thức thanh toán
                      </h2>
                      <p className="text-sm text-gray-500">
                        Chọn cách thanh toán phù hợp
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {[
                      {
                        id: "vnpay",
                        name: "VNPay",
                        icon: CreditCard,
                        description: "Thanh toán qua VNPay QR",
                      },
                      {
                        id: "momo",
                        name: "MoMo SDK",
                        icon: Wallet,
                        description: "Ví điện tử MoMo",
                      },
                      {
                        id: "wallet",
                        name: "Ví của tôi",
                        icon: Wallet,
                        description: "Thanh toán bằng số dư ví",
                      },
                      {
                        id: "stripe",
                        name: "Stripe",
                        icon: CreditCard,
                        description: "Thẻ quốc tế (Visa, Mastercard)",
                      },
                      {
                        id: "bank_transfer",
                        name: "Chuyển khoản",
                        icon: Building2,
                        description: "Chuyển khoản ngân hàng",
                      },
                    ].map((method) => (
                      <div
                        key={method.id}
                        onClick={() => setPaymentMethod(method.id)}
                        className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${paymentMethod === method.id
                            ? "border-purple-500 bg-purple-50 shadow-md"
                            : "border-gray-200 hover:border-purple-300 hover:bg-purple-50/50"
                          }`}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-12 h-12 rounded-lg flex items-center justify-center ${paymentMethod === method.id
                                ? "bg-gradient-to-br from-purple-500 to-blue-500"
                                : "bg-gray-100"
                              }`}
                          >
                            <method.icon
                              className={`w-6 h-6 ${paymentMethod === method.id
                                  ? "text-white"
                                  : "text-gray-500"
                                }`}
                            />
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900">
                              {method.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {method.description}
                            </div>
                          </div>
                          {paymentMethod === method.id && (
                            <CheckCircle2 className="w-6 h-6 text-purple-500" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cart Items */}
                <div className="bg-white rounded-2xl shadow-lg p-6 border border-purple-100">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">
                    Khóa học ({cartItems.length})
                  </h2>

                  {cartItems.length === 0 ? (
                    <div className="py-12 text-center">
                      <p className="text-gray-600">Giỏ hàng trống</p>
                      <Button
                        onClick={() => navigate("/courses")}
                        className="mt-4 bg-gradient-to-r from-purple-600 to-blue-600"
                      >
                        Khám phá khóa học
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cartItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex gap-4 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                        >
                          <img
                            src={item.thumbnail}
                            alt={item.title_vi}
                            className="w-20 h-20 object-cover rounded-lg"
                          />
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 line-clamp-2">
                              {item.title_vi}
                            </h3>
                            <div className="text-sm text-gray-600 mt-1">
                              Khóa học trực tuyến
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-purple-600">
                              {item.price === 0
                                ? "Miễn phí"
                                : `${item.price.toLocaleString("vi-VN")}đ`}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right - Order Summary */}
              <div className="lg:col-span-1">
                <div className="sticky top-20 space-y-6">
                  {/* Coupon Code */}
                  <div className="bg-white rounded-2xl shadow-lg p-6 border border-purple-100">
                    <div className="flex items-center gap-2 mb-4">
                      <Tag className="w-5 h-5 text-purple-600" />
                      <h3 className="font-bold text-gray-900">Mã giảm giá</h3>
                    </div>

                    {appliedCoupon ? (
                      <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                              <span className="font-semibold text-green-900">
                                {appliedCoupon.code}
                              </span>
                            </div>
                            <p className="text-xs text-green-700">
                              {appliedCoupon.description}
                            </p>
                          </div>
                          <button
                            onClick={removeCoupon}
                            className="text-red-500 hover:text-red-700 text-sm font-medium"
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) =>
                            setCouponCode(e.target.value.toUpperCase())
                          }
                          placeholder="Nhập mã giảm giá"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <Button
                          onClick={validateCoupon}
                          disabled={couponLoading || !couponCode.trim()}
                          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                        >
                          {couponLoading ? "Đang kiểm tra..." : "Áp dụng"}
                        </Button>
                      </div>
                    )}

                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs text-blue-900 font-medium mb-1">
                        💡 Mã giảm giá có sẵn:
                      </p>
                      <ul className="text-xs text-blue-700 space-y-1">
                        <li>• WELCOME10 - Giảm 10%</li>
                        <li>• SAVE50K - Giảm 50.000đ</li>
                        <li>• VIP20 - Giảm 20%</li>
                      </ul>
                    </div>
                  </div>

                  {/* Order Summary */}
                  <div className="bg-white rounded-2xl shadow-lg p-6 border border-purple-100">
                    <h3 className="font-bold text-gray-900 mb-6">
                      Tóm tắt đơn hàng
                    </h3>

                    <div className="space-y-4 mb-6">
                      <div className="flex justify-between text-gray-700">
                        <span>Tạm tính:</span>
                        <span className="font-semibold">
                          {totalPrice.toLocaleString("vi-VN")}đ
                        </span>
                      </div>

                      {appliedCoupon && (
                        <div className="flex justify-between text-green-600">
                          <span>Giảm giá:</span>
                          <span className="font-semibold">
                            -{discountAmount.toLocaleString("vi-VN")}đ
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="border-t-2 border-dashed border-gray-300 pt-4 mb-6">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-gray-900">
                          Tổng cộng:
                        </span>
                        <span className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                          {finalPrice.toLocaleString("vi-VN")}đ
                        </span>
                      </div>
                    </div>

                    <Button
                      onClick={handleCheckout}
                      disabled={loading || cartItems.length === 0}
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-4 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all"
                    >
                      {loading ? (
                        "Đang xử lý..."
                      ) : (
                        <>
                          <CreditCard className="w-5 h-5 mr-2" />
                          Hoàn tất thanh toán
                        </>
                      )}
                    </Button>

                    <div className="mt-6 space-y-3">
                      <div className="flex items-start gap-3 text-sm">
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <div className="text-gray-600">
                          <span className="font-semibold text-gray-900">
                            Thanh toán an toàn
                          </span>{" "}
                          - Bảo mật SSL 256-bit
                        </div>
                      </div>
                      <div className="flex items-start gap-3 text-sm">
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <div className="text-gray-600">
                          <span className="font-semibold text-gray-900">
                            Hoàn tiền 30 ngày
                          </span>{" "}
                          - Nếu không hài lòng
                        </div>
                      </div>
                      <div className="flex items-start gap-3 text-sm">
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <div className="text-gray-600">
                          <span className="font-semibold text-gray-900">
                            Truy cập trọn đời
                          </span>{" "}
                          - Học mọi lúc mọi nơi
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Security Badge */}
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-xl text-center">
                    <AlertCircle className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-700">
                      Thông tin của bạn được mã hóa và bảo mật tuyệt đối
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
