import Layout from "@/components/Layout";
import CourseCard from "@/components/CourseCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import apiClient from "@/api/client";

export default function Courses() {
  const { t, language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCourses, setTotalCourses] = useState(0);

  const [searchQuery, setSearchQuery] = useState(
    searchParams.get("search") || ""
  );
  const [sortBy, setSortBy] = useState(searchParams.get("sort") || "popular");
  const [filterDifficulty, setFilterDifficulty] = useState(
    searchParams.get("level") || "all"
  );
  const [filterCategory, setFilterCategory] = useState(
    searchParams.get("category") || "all"
  );
  const [currentPage, setCurrentPage] = useState(
    parseInt(searchParams.get("page") || "1")
  );

  useEffect(() => {
    fetchCourses();
  }, [language, sortBy, filterDifficulty, filterCategory, currentPage]);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: currentPage,
        limit: 8,
        sort: sortBy === "popular" ? undefined : sortBy,
      };

      if (searchQuery) params.search = searchQuery;
      if (filterDifficulty !== "all") params.level = filterDifficulty;
      if (filterCategory !== "all") params.category = filterCategory;

      const response = await apiClient.getCourses(params);

      if (response.success) {
        setCourses(response.data || []);
        setTotalCourses(response.pagination?.total || 0);
      }
    } catch (error) {
      console.error("Error fetching courses:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateURLParams();
    fetchCourses();
  };

  const updateURLParams = () => {
    const params: any = {};
    if (searchQuery) params.search = searchQuery;
    if (sortBy !== "popular") params.sort = sortBy;
    if (filterDifficulty !== "all") params.level = filterDifficulty;
    if (filterCategory !== "all") params.category = filterCategory;
    if (currentPage > 1) params.page = currentPage.toString();
    setSearchParams(params);
  };

  useEffect(() => {
    updateURLParams();
  }, [sortBy, filterDifficulty, filterCategory, currentPage]);

  return (
    <Layout>
      {/* Filters and Courses */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          {/* Result Count */}
          <div className="mb-6">
            <h2 className="text-lg font-medium text-gray-900">
              {loading ? "Đang tải..." : `${totalCourses} khóa học`}
            </h2>
          </div>

          <div>
            {/* Courses Grid */}
            <div>
              {loading ? (
                <div className="text-center py-16">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-900 border-t-transparent mb-4"></div>
                  <p className="text-gray-600 font-medium">
                    {t("common.loading")}
                  </p>
                </div>
              ) : courses.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
                    {courses.map((course) => (
                      <CourseCard
                        key={course.id}
                        id={course.id.toString()}
                        title={course.title}
                        instructor={course.instructor}
                        rating={course.rating}
                        reviews={course.total_reviews}
                        students={course.total_students}
                        lessons={course.total_lessons}
                        difficulty={course.level}
                        thumbnail={course.thumbnail}
                        price={course.price}
                        duration={course.total_duration}
                      />
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalCourses > 8 && (
                    <div className="flex flex-col items-center gap-3 pt-6 border-t border-gray-200">
                      <div className="flex items-center gap-2">
                        <Button
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(currentPage - 1)}
                          className="bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 rounded-sm font-medium px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Trước
                        </Button>

                        <div className="flex items-center gap-1">
                          {Array.from(
                            { length: Math.ceil(totalCourses / 8) },
                            (_, i) => i + 1
                          )
                            .filter((page) => {
                              return (
                                page === 1 ||
                                page === Math.ceil(totalCourses / 8) ||
                                (page >= currentPage - 1 &&
                                  page <= currentPage + 1)
                              );
                            })
                            .map((page, idx, arr) => (
                              <div key={page} className="flex items-center">
                                {idx > 0 && arr[idx - 1] !== page - 1 && (
                                  <span className="px-2 text-gray-500 font-medium">
                                    ...
                                  </span>
                                )}
                                <button
                                  onClick={() => setCurrentPage(page)}
                                  className={`w-10 h-10 font-medium rounded-sm ${
                                    currentPage === page
                                      ? "bg-gray-900 text-white"
                                      : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                                  }`}
                                >
                                  {page}
                                </button>
                              </div>
                            ))}
                        </div>

                        <Button
                          disabled={currentPage >= Math.ceil(totalCourses / 8)}
                          onClick={() => setCurrentPage(currentPage + 1)}
                          className="bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 rounded-sm font-medium px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Tiếp
                        </Button>
                      </div>

                      <p className="text-sm text-gray-600 font-medium">
                        Trang {currentPage} / {Math.ceil(totalCourses / 8)} •
                        Tổng {totalCourses} khóa học
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-16 bg-gray-50 border border-gray-200 rounded-sm p-12">
                  <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                    Không tìm thấy khóa học
                  </h3>
                  <p className="text-gray-600">Thử tìm kiếm với từ khóa khác</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
