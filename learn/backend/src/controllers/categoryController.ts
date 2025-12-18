import { Request, Response } from "express";
import { CategoryModel } from "../models/Category.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { detectLanguage } from "../utils/language.js";

export const categoryController = {
  async getAll(req: Request, res: Response) {
    try {
      const lang = detectLanguage(req);
      const categories = await CategoryModel.findAll(lang);

      // Map to language-specific names
      const mappedCategories = categories.map((cat) => ({
        id: cat.id,
        name: lang === "vi" ? cat.name_vi : cat.name_en,
        icon: cat.icon,
        course_count: cat.course_count || 0,
      }));

      res.json(successResponse(mappedCategories));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },
};


