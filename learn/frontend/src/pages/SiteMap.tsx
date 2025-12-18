import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import {
    BookOpen,
    Users,
    Settings,
    LayoutDashboard,
    GraduationCap,
    ShoppingCart,
    Wallet,
    Bell,
    FileText,
    ClipboardList,
    StickyNote,
    MessageSquare,
    BarChart3,
    Shield,
    Folder,
    ChevronRight,
    Home,
    Search,
    Mail,
    Info,
} from "lucide-react";

interface RouteNode {
    path: string;
    name: string;
    icon: any;
    role?: string;
    children?: RouteNode[];
}

const SiteMap = () => {
    const navigate = useNavigate();

    const routes: RouteNode[] = [
        {
            path: "/",
            name: "Trang chủ",
            icon: Home,
            children: [
                { path: "/courses", name: "Danh sách khóa học", icon: BookOpen },
                { path: "/categories", name: "Danh mục", icon: Folder },
                { path: "/search", name: "Tìm kiếm", icon: Search },
                { path: "/about", name: "Giới thiệu", icon: Info },
                { path: "/contact", name: "Liên hệ", icon: Mail },
            ],
        },
        {
            path: "/my-learning",
            name: "Học tập của tôi",
            icon: GraduationCap,
            role: "student",
            children: [
                { path: "/course/:courseId/lesson/:lessonId", name: "Xem bài học", icon: BookOpen },
                { path: "/courses/:courseId/assignments", name: "Bài tập của khóa học", icon: ClipboardList },
                { path: "/courses/:courseId/notes", name: "Ghi chú của khóa học", icon: StickyNote },
            ],
        },
        {
            path: "/notifications",
            name: "Thông báo",
            icon: Bell,
            role: "all",
        },
        {
            path: "/blogs",
            name: "Blog",
            icon: FileText,
            children: [
                { path: "/blogs/create", name: "Tạo blog", icon: FileText, role: "authenticated" },
                { path: "/blogs/my-blogs", name: "Blog của tôi", icon: FileText, role: "authenticated" },
                { path: "/blogs/saved", name: "Blog đã lưu", icon: FileText, role: "authenticated" },
            ],
        },
        {
            path: "/cart",
            name: "Giỏ hàng",
            icon: ShoppingCart,
            role: "student",
            children: [
                { path: "/checkout", name: "Thanh toán", icon: ShoppingCart },
                { path: "/orders", name: "Đơn hàng", icon: ShoppingCart },
            ],
        },
        {
            path: "/wallet",
            name: "Ví điện tử",
            icon: Wallet,
            role: "authenticated",
        },
        {
            path: "/ai-dashboard",
            name: "AI Dashboard",
            icon: BarChart3,
            role: "authenticated",
        },
        {
            path: "/settings",
            name: "Cài đặt",
            icon: Settings,
            role: "authenticated",
        },
        {
            path: "/instructor",
            name: "Giảng viên",
            icon: Users,
            role: "instructor",
            children: [
                { path: "/instructor/courses", name: "Khóa học của tôi", icon: BookOpen },
                { path: "/instructor/courses/new", name: "Tạo khóa học mới", icon: BookOpen },
                { path: "/instructor/students", name: "Học viên", icon: Users },
                { path: "/instructor/courses/:id/lessons", name: "Quản lý bài học", icon: BookOpen },
                { path: "/instructor/courses/:id/analytics", name: "Thống kê khóa học", icon: BarChart3 },
                { path: "/instructor/courses/:courseId/assignments", name: "Quản lý bài tập", icon: ClipboardList },
                { path: "/instructor/courses/:courseId/assignments/create", name: "Tạo bài tập", icon: ClipboardList },
                { path: "/instructor/assignments/:assignmentId/submissions", name: "Chấm bài", icon: ClipboardList },
            ],
        },
        {
            path: "/admin",
            name: "Quản trị viên",
            icon: Shield,
            role: "admin",
            children: [
                { path: "/admin/users", name: "Quản lý người dùng", icon: Users },
                { path: "/admin/courses", name: "Quản lý khóa học", icon: BookOpen },
                { path: "/admin/analytics", name: "Thống kê", icon: BarChart3 },
                { path: "/admin/lessons", name: "Quản lý bài học", icon: BookOpen },
                { path: "/admin/categories", name: "Quản lý danh mục", icon: Folder },
                { path: "/admin/enrollments", name: "Quản lý ghi danh", icon: Users },
                { path: "/admin/course-approvals", name: "Duyệt khóa học", icon: Shield },
                { path: "/admin/refunds", name: "Quản lý hoàn tiền", icon: Wallet },
                { path: "/admin/orders", name: "Quản lý đơn hàng", icon: ShoppingCart },
                { path: "/admin/server", name: "Giám sát server", icon: BarChart3 },
                { path: "/admin/settings", name: "Cài đặt hệ thống", icon: Settings },
            ],
        },
    ];

    const getRoleBadge = (role?: string) => {
        if (!role) return null;
        const colors: Record<string, string> = {
            student: "bg-blue-100 text-blue-800",
            instructor: "bg-purple-100 text-purple-800",
            admin: "bg-red-100 text-red-800",
            authenticated: "bg-green-100 text-green-800",
            all: "bg-gray-100 text-gray-800",
        };
        const labels: Record<string, string> = {
            student: "Học viên",
            instructor: "Giảng viên",
            admin: "Admin",
            authenticated: "Đã đăng nhập",
            all: "Tất cả",
        };
        return (
            <Badge className={`${colors[role]} text-xs`}>
                {labels[role]}
            </Badge>
        );
    };

    const renderRoute = (route: RouteNode, level: number = 0) => {
        const Icon = route.icon;
        const paddingLeft = level * 24;

        return (
            <div key={route.path} className="space-y-2">
                <div
                    className={`flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer`}
                    style={{ paddingLeft: `${paddingLeft + 12}px` }}
                    onClick={() => {
                        if (!route.path.includes(":")) {
                            navigate(route.path);
                        }
                    }}
                >
                    <Icon className="w-5 h-5 text-blue-600" />
                    <span className="flex-1 font-medium">{route.name}</span>
                    {getRoleBadge(route.role)}
                    <span className="text-sm text-gray-500">{route.path}</span>
                    {route.children && <ChevronRight className="w-4 h-4 text-gray-400" />}
                </div>

                {route.children && (
                    <div className="space-y-1">
                        {route.children.map((child) => renderRoute(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <Layout>
            <div className="container mx-auto px-4 py-8">
                <div className="max-w-7xl mx-auto">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold mb-2">Sơ đồ trang web</h1>
                        <p className="text-gray-600">
                            Xem toàn bộ cấu trúc và chức năng của hệ thống. Click vào để điều hướng.
                        </p>
                    </div>

                    {/* Statistics */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-gray-600">
                                    Tổng số trang
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-blue-600">
                                    {routes.reduce((acc, r) => acc + 1 + (r.children?.length || 0), 0)}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-gray-600">
                                    Chức năng chính
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-purple-600">
                                    {routes.length}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-gray-600">
                                    Trang Admin
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-red-600">
                                    {routes.find(r => r.path === "/admin")?.children?.length || 0}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-gray-600">
                                    Trang Instructor
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-green-600">
                                    {routes.find(r => r.path === "/instructor")?.children?.length || 0}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Route Tree */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MessageSquare className="w-5 h-5" />
                                Cấu trúc điều hướng
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-1">
                                {routes.map((route) => renderRoute(route))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Legend */}
                    <Card className="mt-6">
                        <CardHeader>
                            <CardTitle className="text-sm">Chú thích phân quyền</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-3">
                                <div className="flex items-center gap-2">
                                    <Badge className="bg-blue-100 text-blue-800">Học viên</Badge>
                                    <span className="text-sm text-gray-600">Dành cho học viên</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge className="bg-purple-100 text-purple-800">Giảng viên</Badge>
                                    <span className="text-sm text-gray-600">Dành cho giảng viên</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge className="bg-red-100 text-red-800">Admin</Badge>
                                    <span className="text-sm text-gray-600">Dành cho quản trị viên</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge className="bg-green-100 text-green-800">Đã đăng nhập</Badge>
                                    <span className="text-sm text-gray-600">Yêu cầu đăng nhập</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge className="bg-gray-100 text-gray-800">Tất cả</Badge>
                                    <span className="text-sm text-gray-600">Ai cũng truy cập được</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Hidden Features Info */}
                    <Card className="mt-6 border-orange-200 bg-orange-50">
                        <CardHeader>
                            <CardTitle className="text-sm text-orange-800">
                                💡 Chức năng ẩn (chưa có link trên UI)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-2">
                            <div className="flex items-start gap-2">
                                <ChevronRight className="w-4 h-4 mt-0.5 text-orange-600" />
                                <div>
                                    <strong>AI Dashboard:</strong> Phân tích học tập bằng AI - Truy cập qua{" "}
                                    <code className="bg-white px-2 py-1 rounded">/ai-dashboard</code>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <ChevronRight className="w-4 h-4 mt-0.5 text-orange-600" />
                                <div>
                                    <strong>Ví điện tử:</strong> Quản lý số dư và giao dịch - Truy cập qua{" "}
                                    <code className="bg-white px-2 py-1 rounded">/wallet</code>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <ChevronRight className="w-4 h-4 mt-0.5 text-orange-600" />
                                <div>
                                    <strong>Bài tập (Assignments):</strong> Nộp và chấm bài - Link có trong trang khóa học
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <ChevronRight className="w-4 h-4 mt-0.5 text-orange-600" />
                                <div>
                                    <strong>Ghi chú (Notes):</strong> Ghi chú khi học - Có trong LessonPlayer
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <ChevronRight className="w-4 h-4 mt-0.5 text-orange-600" />
                                <div>
                                    <strong>Analytics:</strong> Thống kê chi tiết - Truy cập qua{" "}
                                    <code className="bg-white px-2 py-1 rounded">/analytics</code>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </Layout>
    );
};

export default SiteMap;
