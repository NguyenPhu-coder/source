import { Request, Response } from "express";
import { BlogModel } from "../models/Blog.js";
import { successResponse, errorResponse } from "../utils/response.js";

export const blogController = {
  // Get all published blogs
  async getAll(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const blogs = await BlogModel.findAll(userId);
      res.json(successResponse(blogs));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  // Get single blog by ID
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      const blog = await BlogModel.findById(parseInt(id), userId);

      if (!blog) {
        return res.status(404).json(errorResponse("Blog not found", 404));
      }

      res.json(successResponse(blog));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  // Get current user's blogs (all statuses)
  async getMyBlogs(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const blogs = await BlogModel.findByUserId(userId);
      res.json(successResponse(blogs));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  // Create new blog
  async create(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { title, content, thumbnail, status } = req.body;

      if (!title || !content) {
        return res
          .status(400)
          .json(errorResponse("Title and content are required", 400));
      }

      const blogId = await BlogModel.create({
        author_id: userId,
        title,
        content,
        thumbnail: thumbnail || null,
        status: status || "draft",
      });

      const blog = await BlogModel.findById(blogId);
      res.status(201).json(successResponse(blog, "Blog created successfully"));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  // Update blog
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;
      const { title, content, thumbnail, status } = req.body;

      // Check if blog exists and belongs to user
      const existingBlog = await BlogModel.findById(parseInt(id));
      if (!existingBlog) {
        return res.status(404).json(errorResponse("Blog not found", 404));
      }

      if (existingBlog.author_id !== userId) {
        return res
          .status(403)
          .json(errorResponse("Not authorized to update this blog", 403));
      }

      const updated = await BlogModel.update(parseInt(id), {
        title,
        content,
        thumbnail,
        status,
      });

      if (!updated) {
        return res.status(400).json(errorResponse("No changes made", 400));
      }

      const blog = await BlogModel.findById(parseInt(id));
      res.json(successResponse(blog, "Blog updated successfully"));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  // Delete blog
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;

      // Check if blog exists and belongs to user
      const existingBlog = await BlogModel.findById(parseInt(id));
      if (!existingBlog) {
        return res.status(404).json(errorResponse("Blog not found", 404));
      }

      if (existingBlog.author_id !== userId) {
        return res
          .status(403)
          .json(errorResponse("Not authorized to delete this blog", 403));
      }

      await BlogModel.delete(parseInt(id));
      res.json(successResponse(null, "Blog deleted successfully"));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  // Save/bookmark a blog
  async saveBlog(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;

      const blog = await BlogModel.findById(parseInt(id));
      if (!blog) {
        return res.status(404).json(errorResponse("Blog not found", 404));
      }

      const saved = await BlogModel.saveBlog(userId, parseInt(id));
      if (!saved) {
        return res.status(400).json(errorResponse("Blog already saved", 400));
      }

      res.json(successResponse(null, "Blog saved successfully"));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  // Unsave/unbookmark a blog
  async unsaveBlog(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;

      const unsaved = await BlogModel.unsaveBlog(userId, parseInt(id));
      if (!unsaved) {
        return res.status(400).json(errorResponse("Blog was not saved", 400));
      }

      res.json(successResponse(null, "Blog unsaved successfully"));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  // Get user's saved blogs
  async getSavedBlogs(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const blogs = await BlogModel.getSavedBlogs(userId);
      res.json(successResponse(blogs));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },
};
