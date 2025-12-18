const API_BASE_URL = "http://127.0.0.1:3000";

/**
 * Chuyển đổi đường dẫn ảnh thành URL đầy đủ
 * @param path - Đường dẫn ảnh từ database (có thể là /uploads/..., uploads/..., hoặc URL đầy đủ)
 * @returns URL đầy đủ hoặc placeholder nếu không hợp lệ
 */
export function getImageUrl(path: string | null | undefined): string {
  // Nếu không có path, trả về placeholder
  if (!path || path.trim() === "") {
    return "/images/placeholder-course.svg";
  }

  // Nếu đã là URL đầy đủ (http/https), trả về nguyên bản
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  // Nếu là data URI, trả về nguyên bản
  if (path.startsWith("data:")) {
    return path;
  }

  // Nếu là đường dẫn tương đối local (bắt đầu với /images/), trả về nguyên bản
  if (path.startsWith("/images/")) {
    return path;
  }

  // Xử lý đường dẫn từ backend
  // Đảm bảo path bắt đầu bằng /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${API_BASE_URL}${normalizedPath}`;
}

/**
 * Lấy URL cho thumbnail nhỏ (200x200)
 */
export function getSmallPlaceholder(): string {
  return "/images/placeholder-small.svg";
}

/**
 * Lấy URL cho placeholder course (800x400)
 */
export function getCoursePlaceholder(): string {
  return "/images/placeholder-course.svg";
}
