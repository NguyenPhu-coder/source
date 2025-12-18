import { LucideIcon, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
// @ts-ignore
import { useLanguage } from "@/contexts/LanguageContext";
import * as Icons from "lucide-react";

interface CategoryCardProps {
  id: string;
  name: string;
  icon?: string | LucideIcon | null;
  courseCount: number;
}

export default function CategoryCard({
  id,
  name,
  icon,
  courseCount,
}: CategoryCardProps) {
  useLanguage();

  // Check if icon is a URL (starts with http or data:)
  const isImageUrl =
    typeof icon === "string" &&
    (icon.startsWith("http") || icon.startsWith("data:"));

  // Convert string icon name to component or use default
  const IconComponent: LucideIcon = (() => {
    if (!icon || isImageUrl) return BookOpen;
    if (typeof icon === "string") {
      return (Icons as any)[icon] || BookOpen;
    }
    return icon || BookOpen;
  })();

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.display = "none";
    const parent = e.currentTarget.parentElement;
    if (parent) {
      const iconDiv = parent.querySelector(".icon-fallback") as HTMLElement;
      if (iconDiv) iconDiv.style.display = "flex";
    }
  };

  return (
    <Link to={`/courses?category=${id}`}>
      <div className="bg-white border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all p-6 cursor-pointer h-full rounded-lg group">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="relative w-16 h-16">
            {isImageUrl ? (
              <>
                <img
                  src={icon as string}
                  alt={name}
                  className="w-16 h-16 object-cover rounded-lg"
                  onError={handleImageError}
                />
                <div className="icon-fallback hidden w-16 h-16 bg-gray-100 group-hover:bg-gray-200 transition-colors items-center justify-center rounded-lg">
                  <IconComponent className="w-8 h-8 text-gray-700" />
                </div>
              </>
            ) : (
              <div className="w-16 h-16 bg-gray-100 group-hover:bg-gray-200 transition-colors flex items-center justify-center rounded-lg">
                <IconComponent className="w-8 h-8 text-gray-700" />
              </div>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-1 text-base">
              {name}
            </h3>
            <p className="text-sm text-gray-500">{courseCount} khóa học</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
