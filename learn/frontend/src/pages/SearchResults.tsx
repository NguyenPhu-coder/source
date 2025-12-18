import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { useSearchParams } from "react-router-dom";
import CourseCard from "@/components/CourseCard";
import { Search, Filter, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Course {
  id: number;
  title: string;
  description: string;
  thumbnail: string;
  instructor: string;
  instructor_avatar: string;
  price: number;
  rating: number;
  total_students: number;
  level: string;
  category: string;
}

export default function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    category: searchParams.get("category") || "",
    level: searchParams.get("level") || "",
    priceMin: searchParams.get("priceMin") || "",
    priceMax: searchParams.get("priceMax") || "",
    rating: searchParams.get("rating") || "",
  });

  useEffect(() => {
    fetchSearchResults();
  }, [searchParams]);

  const fetchSearchResults = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchParams.get("q"))
        params.append("search", searchParams.get("q")!);
      if (searchParams.get("category"))
        params.append("category", searchParams.get("category")!);
      if (searchParams.get("level"))
        params.append("level", searchParams.get("level")!);

      const response = await fetch(
        `http://127.0.0.1:3000/api/courses?${params}`
      );
      const data = await response.json();
      setCourses(data.data || []);
    } catch (error) {
      console.error("Error fetching search results:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (searchTerm) {
      params.set("q", searchTerm);
    } else {
      params.delete("q");
    }
    setSearchParams(params);
  };

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams);

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    setSearchParams(params);
    setShowFilters(false);
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-12">
        <div className="container mx-auto px-4">
          {/* Search Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
              Kết quả tìm kiếm
            </h1>

            {/* Search Bar */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <form onSubmit={handleSearch} className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm kiếm khóa học..."
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-blue-500 to-indigo-600"
                >
                  <Search className="w-4 h-4 mr-2" />
                  Tìm kiếm
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <SlidersHorizontal className="w-4 h-4 mr-2" />
                  Bộ lọc
                  {hasActiveFilters && (
                    <span className="ml-2 w-2 h-2 bg-blue-600 rounded-full"></span>
                  )}
                </Button>
              </form>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  Bộ lọc nâng cao
                </h3>
                <button onClick={() => setShowFilters(false)}>
                  <X className="w-5 h-5 text-gray-500 hover:text-gray-700" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Danh mục
                  </label>
                  <select
                    value={filters.category}
                    onChange={(e) =>
                      setFilters({ ...filters, category: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Tất cả</option>
                    <option value="1">Công nghệ</option>
                    <option value="2">Kinh doanh</option>
                    <option value="3">Thiết kế</option>
                    <option value="4">Marketing</option>
                  </select>
                </div>

                {/* Level */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cấp độ
                  </label>
                  <select
                    value={filters.level}
                    onChange={(e) =>
                      setFilters({ ...filters, level: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Tất cả</option>
                    <option value="beginner">Cơ bản</option>
                    <option value="intermediate">Trung cấp</option>
                    <option value="advanced">Nâng cao</option>
                  </select>
                </div>

                {/* Price Min */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Giá từ
                  </label>
                  <input
                    type="number"
                    value={filters.priceMin}
                    onChange={(e) =>
                      setFilters({ ...filters, priceMin: e.target.value })
                    }
                    placeholder="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Price Max */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Giá đến
                  </label>
                  <input
                    type="number"
                    value={filters.priceMax}
                    onChange={(e) =>
                      setFilters({ ...filters, priceMax: e.target.value })
                    }
                    placeholder="1000"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Rating Filter */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Đánh giá tối thiểu
                </label>
                <div className="flex gap-2">
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <button
                      key={rating}
                      onClick={() =>
                        setFilters({ ...filters, rating: rating.toString() })
                      }
                      className={`px-4 py-2 rounded-lg border transition-all ${
                        filters.rating === rating.toString()
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-700 border-gray-300 hover:border-blue-500"
                      }`}
                    >
                      {rating} ⭐
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div>
                <Button
                  onClick={applyFilters}
                  className="w-full bg-gradient-to-r from-blue-500 to-indigo-600"
                >
                  Áp dụng bộ lọc
                </Button>
              </div>
            </div>
          )}

          {/* Results Info */}
          <div className="mb-6 flex items-center justify-between">
            <p className="text-gray-600">
              Tìm thấy{" "}
              <span className="font-bold text-gray-900">{courses.length}</span>{" "}
              khóa học
              {searchParams.get("q") && (
                <span>
                  {" "}
                  cho "
                  <span className="font-semibold">{searchParams.get("q")}</span>
                  "
                </span>
              )}
            </p>
          </div>

          {/* Results Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Đang tìm kiếm...</p>
              </div>
            </div>
          ) : courses.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
              <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Không tìm thấy kết quả
              </h3>
              <p className="text-gray-600">
                Thử tìm kiếm với từ khóa khác hoặc điều chỉnh bộ lọc
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course) => (
                <CourseCard
                  key={course.id}
                  id={course.id.toString()}
                  title={course.title}
                  instructor={course.instructor}
                  rating={course.rating}
                  reviews={0}
                  students={course.total_students}
                  lessons={0}
                  difficulty={
                    course.level as "Beginner" | "Intermediate" | "Advanced"
                  }
                  thumbnail={course.thumbnail}
                  price={course.price}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
