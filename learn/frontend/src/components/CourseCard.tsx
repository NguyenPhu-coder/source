import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Users, BookOpen, Clock, PlayCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

interface CourseCardProps {
  id: string;
  title: string;
  instructor: string;
  rating: number;
  reviews: number;
  students: number;
  lessons: number;
  difficulty: string;
  thumbnail: string;
  price: number | string;
  duration?: string;
}

export default function CourseCard({
  id,
  title,
  instructor,
  rating,
  reviews,
  students,
  lessons,
  difficulty,
  thumbnail,
  price,
  duration,
}: CourseCardProps) {
  return (
    <Link to={`/course/${id}`}>
      <motion.div
        whileHover={{ y: -8 }}
        transition={{ type: "spring", stiffness: 300 }}
        className="h-full"
      >
        <Card className="h-full overflow-hidden border-border/50 bg-white hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 group rounded-2xl cursor-pointer flex flex-col relative">
          <div className="relative aspect-video overflow-hidden">
            <img
              src={thumbnail || "/placeholder.jpg"}
              alt={title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white"
              >
                <PlayCircle className="w-6 h-6 fill-current" />
              </motion.div>
            </div>
            <div className="absolute top-3 right-3 flex gap-2">
              <Badge variant="secondary" className="bg-white/90 backdrop-blur-sm text-gray-800 font-semibold shadow-sm hover:bg-white">
                {difficulty}
              </Badge>
            </div>
            {(!price || price === 0 || price === "0") && (
              <div className="absolute top-3 left-3">
                <Badge className="bg-green-500 hover:bg-green-600 text-white font-bold shadow-lg shadow-green-900/20">Miễn phí</Badge>
              </div>
            )}

            {/* New: Duration Badge */}
            <div className="absolute bottom-3 right-3">
              <div className="bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-white text-xs font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {duration || `${lessons * 15}m`}
              </div>
            </div>
          </div>

          <CardHeader className="p-5 pb-2">
            <div className="flex justify-between items-start gap-2 mb-2">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Course</span>
              <div className="flex items-center text-orange-500 text-xs font-bold gap-1 bg-orange-50 px-2 py-1 rounded-full border border-orange-100">
                <Star className="w-3 h-3 fill-current" />
                {rating} <span className="text-gray-400 font-normal">({reviews})</span>
              </div>
            </div>
            <h3 className="font-bold text-lg leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors h-[3.5rem]">
              {title}
            </h3>
            <div className="flex items-center gap-2 pt-1">
              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                {instructor.charAt(0)}
              </div>
              <p className="text-sm text-gray-500 font-medium line-clamp-1">{instructor}</p>
            </div>
          </CardHeader>

          <CardContent className="p-5 py-2">
            <div className="grid grid-cols-2 gap-3 text-xs text-gray-500 mt-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                <span className="font-medium">{students?.toLocaleString()} học viên</span>
              </div>
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-purple-500" />
                <span className="font-medium">{lessons} bài học</span>
              </div>
            </div>
          </CardContent>

          <CardFooter className="p-5 pt-0 border-t border-gray-50 mt-auto flex items-center justify-between bg-white rounded-b-2xl">
            <div className="py-4">
              {price && price !== 0 && price !== "0" ? (
                <div className="flex flex-col">
                  {/* Mock Original Price for perceived value */}
                  <span className="text-xs text-gray-400 line-through">
                    {new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(price) * 1.2)}
                  </span>
                  <span className="text-lg font-bold text-blue-600">
                    {new Intl.NumberFormat("vi-VN", {
                      style: "currency",
                      currency: "VND",
                    }).format(Number(price))}
                  </span>
                </div>
              ) : (
                <span className="text-lg font-bold text-green-600">Miễn phí</span>
              )}
            </div>
            <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-semibold group/btn">
              Chi tiết
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </Link>
  );
}
