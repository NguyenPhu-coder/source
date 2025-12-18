/**
 * AI-Enhanced Dashboard
 * Unified dashboard integrating all AI agent functionalities
 * Design: Premium Glassmorphism ("Sang Xin Min")
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    BarChart3,
    BookOpen,
    BrainCircuit,
    Bot,
    FileQuestion,
    Network,
    Sparkles,
    Menu,
    X,
    ChevronRight
} from 'lucide-react';

import {
    ContentQualityIndicator,
    RecommendationsWidget,
    AnalyticsDashboard,
    QuizGenerator,
    CourseKnowledgeGraph,
    AgentManagementPanel
} from '../components';

// Remove old CSS import in favor of Tailwind
// import '../styles/AIEnhancedDashboard.css';

export const AIEnhancedDashboard = ({ userId, userRole = 'student' }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [currentCourse, setCurrentCourse] = useState(null);

    // Configuration for tabs based on role
    const getTabs = () => {
        const commonTabs = [
            { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard }
        ];

        if (userRole === 'admin') {
            return [
                ...commonTabs,
                { id: 'analytics', label: 'Phân tích hệ thống', icon: BarChart3 },
                { id: 'content', label: 'Chất lượng nội dung', icon: BookOpen },
                { id: 'agents', label: 'Quản lý AI Agent', icon: Bot }
            ];
        } else if (userRole === 'instructor') {
            return [
                ...commonTabs,
                { id: 'analytics', label: 'Phân tích khóa học', icon: BarChart3 },
                { id: 'content', label: 'Kiểm tra chất lượng', icon: BookOpen },
                { id: 'quiz', label: 'Tạo Quiz AI', icon: FileQuestion },
                { id: 'graph', label: 'Sơ đồ tri thức', icon: Network }
            ];
        } else {
            // student
            return [
                ...commonTabs,
                { id: 'recommendations', label: 'Gợi ý học tập', icon: Sparkles },
                { id: 'analytics', label: 'Tiến độ của tôi', icon: BarChart3 },
                { id: 'graph', label: 'Bản đồ tư duy', icon: Network }
            ];
        }
    };

    const tabs = getTabs();

    return (
        <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-background relative w-full">
            {/* Aurora Background Effect */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden pb-10">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/20 blur-[120px] animate-blob"></div>
                <div className="absolute top-[20%] right-[-10%] w-[40%] h-[60%] rounded-full bg-purple-500/20 blur-[120px] animate-blob animation-delay-2000"></div>
                <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[40%] rounded-full bg-blue-500/20 blur-[120px] animate-blob animation-delay-4000"></div>
            </div>

            {/* Mobile Sidebar Toggle */}
            <button
                className="md:hidden absolute top-4 left-4 z-50 p-2 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 text-foreground"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
                {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {/* Sidebar Navigation */}
            <motion.aside
                initial={{ x: -300, opacity: 0 }}
                animate={{ x: isSidebarOpen ? 0 : -300, opacity: isSidebarOpen ? 1 : 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={`
                    absolute md:relative z-40 h-full
                    w-72 flex-shrink-0
                    border-r border-white/10 dark:border-white/5
                    bg-white/40 dark:bg-black/20 backdrop-blur-md
                    shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]
                    md:translate-x-0 md:opacity-100
                    ${!isSidebarOpen && 'md:hidden'}
                `}
            >
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                            <BrainCircuit className="text-white w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
                                AI Lab
                            </h2>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Intelligence</p>
                        </div>
                    </div>

                    <nav className="space-y-2">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setActiveTab(tab.id);
                                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                                }}
                                className={`
                                    w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group
                                    ${activeTab === tab.id
                                        ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20'
                                        : 'hover:bg-white/50 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground hover:translate-x-1'
                                    }
                                `}
                            >
                                <tab.icon
                                    size={20}
                                    className={`transition-colors duration-300 ${activeTab === tab.id ? 'text-primary' : 'group-hover:text-primary'}`}
                                />
                                <span className="font-medium">{tab.label}</span>
                                {activeTab === tab.id && (
                                    <motion.div layoutId="active-pill" className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                                )}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Sidebar Footer */}
                <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="text-xs font-semibold text-primary">System Online</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            AI Agents đang hoạt động tối ưu để hỗ trợ bạn.
                        </p>
                    </div>
                </div>
            </motion.aside>

            {/* Main Content Area */}
            <main className="flex-1 h-full overflow-y-auto overflow-x-hidden p-6 md:p-10 scrollbar-hide">
                <div className="max-w-7xl mx-auto pb-20">
                    <header className="mb-8 p-1">
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                            <div>
                                <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                                    {tabs.find(t => t.id === activeTab)?.label}
                                </h1>
                                <p className="text-muted-foreground mt-1">
                                    Chào mừng trở lại, phiên làm việc thông minh của bạn đã sẵn sàng.
                                </p>
                            </div>
                        </motion.div>
                    </header>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, scale: 0.98, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.98, y: -10 }}
                            transition={{ duration: 0.3 }}
                            className="w-full"
                        >
                            {/* Render Content Based on Layout */}
                            {userRole === 'student' && (
                                <>
                                    {activeTab === 'overview' && (
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                            <div className="space-y-8">
                                                <div className="glass-panel p-6 rounded-3xl border border-white/20 shadow-xl bg-white/40 dark:bg-black/20 backdrop-blur-md">
                                                    <div className="flex items-center justify-between mb-6">
                                                        <h3 className="font-bold text-xl flex items-center gap-2">
                                                            <Sparkles className="w-5 h-5 text-accent" /> Gợi ý cho bạn
                                                        </h3>
                                                        <button
                                                            onClick={() => setActiveTab('recommendations')}
                                                            className="text-primary text-sm font-semibold flex items-center gap-1 hover:gap-2 transition-all"
                                                        >
                                                            Xem tất cả <ChevronRight size={16} />
                                                        </button>
                                                    </div>
                                                    <RecommendationsWidget userId={userId} />
                                                </div>
                                            </div>

                                            <div className="space-y-8">
                                                <div className="glass-panel p-6 rounded-3xl border border-white/20 shadow-xl bg-white/40 dark:bg-black/20 backdrop-blur-md">
                                                    <div className="flex items-center justify-between mb-6">
                                                        <h3 className="font-bold text-xl flex items-center gap-2">
                                                            <BarChart3 className="w-5 h-5 text-blue-500" /> Tiến độ học tập
                                                        </h3>
                                                        <button
                                                            onClick={() => setActiveTab('analytics')}
                                                            className="text-primary text-sm font-semibold flex items-center gap-1 hover:gap-2 transition-all"
                                                        >
                                                            Chi tiết <ChevronRight size={16} />
                                                        </button>
                                                    </div>
                                                    <AnalyticsDashboard userId={userId} />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'recommendations' && (
                                        <div className="glass-panel p-8 rounded-3xl border border-white/20 bg-white/40 dark:bg-black/20 backdrop-blur-xl">
                                            <RecommendationsWidget userId={userId} showExtended={true} />
                                        </div>
                                    )}

                                    {activeTab === 'analytics' && (
                                        <div className="glass-panel p-8 rounded-3xl border border-white/20 bg-white/40 dark:bg-black/20 backdrop-blur-xl">
                                            <AnalyticsDashboard userId={userId} showExtended={true} />
                                        </div>
                                    )}

                                    {activeTab === 'graph' && (
                                        <div className="glass-panel p-8 rounded-3xl border border-white/20 bg-white/40 dark:bg-black/20 backdrop-blur-xl min-h-[500px] flex items-center justify-center">
                                            {currentCourse ? (
                                                <CourseKnowledgeGraph courseId={currentCourse.id} />
                                            ) : (
                                                <div className="text-center p-10">
                                                    <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                                                        <Network className="w-10 h-10 text-primary" />
                                                    </div>
                                                    <h3 className="text-xl font-bold mb-2">Chưa chọn khóa học</h3>
                                                    <p className="text-muted-foreground">Vui lòng chọn một khóa học để xem bản đồ tri thức.</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Implement other roles (instructor/admin) similarly with the new wrapper style */}
                            {userRole !== 'student' && (
                                <div className="p-10 text-center glass-panel rounded-3xl">
                                    <h2 className="text-2xl font-bold mb-4">Dashboard cho {userRole} đang được cập nhật giao diện mới...</h2>
                                    <p className="text-muted-foreground">Vui lòng quay lại sau hoặc sử dụng tài khoản Student để trải nghiệm.</p>
                                    {/* Temporary fallback to show content for dev/demo purposes */}
                                    <div className="mt-8 opacity-50 pointer-events-none filter blur-sm">
                                        <AnalyticsDashboard userId={userId} />
                                    </div>
                                </div>
                            )}

                        </motion.div>
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
};

export default AIEnhancedDashboard;
