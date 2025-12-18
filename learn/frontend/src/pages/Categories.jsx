import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import Layout from "@/components/Layout";
import CategoryCard from "@/components/CategoryCard";
import {
  Code,
  Palette,
  BarChart3,
  Megaphone,
  Camera,
  Microscope,
  Languages,
  Briefcase,
  TrendingUp,
  Brain,
  Heart,
} from "lucide-react";
import apiClient from "@/api/client";

// Icon mapping
const iconMap = {
  Code: Code,
  Palette: Palette,
  BarChart3: BarChart3,
  Megaphone: Megaphone,
  Camera: Camera,
  Microscope: Microscope,
  Languages: Languages,
  Briefcase: Briefcase,
  TrendingUp: TrendingUp,
  Brain: Brain,
  Heart: Heart,
};

export default function Categories() {
  const { t } = useLanguage();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await apiClient.getCategories();
        const categoriesData = response.data || [];
        setCategories(categoriesData);
      } catch (error) {
        console.error("Error fetching categories:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        {/* Hero Section */}
        <section className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                {t("categoriesPage.title")}
              </h1>
              <p className="text-xl text-blue-100">
                {loading
                  ? t("categoriesPage.subtitle")
                  : (
                      t("categories.description") ||
                      "Choose from {count} expert-led courses"
                    ).replace(
                      "{count}",
                      categories
                        .reduce((sum, cat) => sum + (cat.course_count || 0), 0)
                        .toString()
                    )}
              </p>
            </div>
          </div>
        </section>

        {/* Categories Grid */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-600">{t("common.loading")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {categories.map((category) => {
                  const IconComponent = iconMap[category.icon] || Briefcase;
                  return (
                    <CategoryCard
                      key={category.id}
                      id={category.id.toString()}
                      name={category.name}
                      icon={IconComponent}
                      courseCount={category.course_count || 0}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl font-bold mb-4">
                {t("categoriesPage.cta.title")}
              </h2>
              <p className="text-gray-600 mb-8">
                {t("categoriesPage.cta.subtitle")}
              </p>
              <a
                href="/courses"
                className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                {t("categoriesPage.cta.button")}
              </a>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
