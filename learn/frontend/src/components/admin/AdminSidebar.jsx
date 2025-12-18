import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  FileText,
  FolderTree,
  UserCheck,
  Star,
  Settings,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  DollarSign,
  Server,
  ShoppingCart,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const menuItems = [
  {
    icon: LayoutDashboard,
    labelKey: "admin.analytics",
    path: "/admin/analytics",
    badge: null,
  },
  { icon: Users, labelKey: "admin.users", path: "/admin/users", badge: null },
  {
    icon: BookOpen,
    labelKey: "admin.courses",
    path: "/admin/courses",
    badge: null,
  },
  {
    icon: CheckCircle,
    labelKey: "admin.courseApprovals",
    path: "/admin/course-approvals",
    badge: null,
  },
  {
    icon: FileText,
    labelKey: "admin.lessons",
    path: "/admin/lessons",
    badge: null,
  },
  {
    icon: FolderTree,
    labelKey: "admin.categories",
    path: "/admin/categories",
    badge: null,
  },
  {
    icon: UserCheck,
    labelKey: "admin.enrollments",
    path: "/admin/enrollments",
    badge: null,
  },
  {
    icon: DollarSign,
    labelKey: "admin.refunds",
    path: "/admin/refunds",
    badge: null,
  },
  {
    icon: ShoppingCart,
    labelKey: "admin.orders",
    path: "/admin/orders",
    badge: null,
  },
  {
    icon: Settings,
    labelKey: "admin.settings",
    path: "/admin/settings",
    badge: null,
  },
];

export default function AdminSidebar({ isOpen, onToggle }) {
  const { t } = useLanguage();
  return (
    <aside
      className={`fixed top-0 left-0 h-screen bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 z-50 ${isOpen ? "w-64" : "w-20 -translate-x-full lg:translate-x-0"
        }`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700">
        {isOpen && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <span className="font-bold text-lg dark:text-white">
              {t("admin.panel")}
            </span>
          </div>
        )}
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          {isOpen ? (
            <ChevronLeft className="w-5 h-5 dark:text-gray-300" />
          ) : (
            <ChevronRight className="w-5 h-5 dark:text-gray-300" />
          )}
        </button>
      </div>

      {/* Menu Items */}
      <nav className="p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`
              }
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {isOpen && (
                <>
                  <span className="font-medium">{t(item.labelKey)}</span>
                  {item.badge && (
                    <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User Info at Bottom */}
      {isOpen && (
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">A</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm dark:text-white truncate">
                Admin User
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                admin@example.com
              </p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
