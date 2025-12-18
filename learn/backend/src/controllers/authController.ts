import { Request, Response } from "express";
import { UserModel } from "../models/User.js";
import { generateToken } from "../middleware/auth.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { getTranslation, detectLanguage } from "../utils/language.js";

export const authController = {
  async register(req: Request, res: Response) {
    try {
      const { name, email, password, avatar } = req.body;
      const lang = detectLanguage(req);

      // Validation
      if (!name || !email || !password) {
        return res
          .status(400)
          .json(
            errorResponse(getTranslation(lang, "validation.emailRequired"), 400)
          );
      }

      // Check if user exists
      const existingUser = await UserModel.findByEmail(email);
      if (existingUser) {
        return res
          .status(400)
          .json(errorResponse("Email already registered", 400));
      }

      // Create user
      const userId = await UserModel.create({
        name,
        email,
        password,
        avatar:
          avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
        role: "student",
      });

      // Get created user
      const user = await UserModel.findById(userId);

      if (!user) {
        return res
          .status(500)
          .json(errorResponse("Failed to create user", 500));
      }

      // Generate token
      const token = generateToken({
        id: user.id!,
        email: user.email,
        role: user.role,
      });

      res.status(201).json(
        successResponse(
          {
            user,
            token,
          },
          getTranslation(lang, "common.success")
        )
      );
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const lang = detectLanguage(req);

      // Validation
      if (!email || !password) {
        return res
          .status(400)
          .json(
            errorResponse(getTranslation(lang, "validation.emailRequired"), 400)
          );
      }

      // Find user
      const user = await UserModel.findByEmail(email);
      if (!user) {
        return res
          .status(401)
          .json(
            errorResponse(
              getTranslation(lang, "common.invalidCredentials"),
              401
            )
          );
      }

      // Check if user registered via Google (no password)
      if (!user.password) {
        return res
          .status(401)
          .json(
            errorResponse(
              "This account uses Google login. Please sign in with Google.",
              401
            )
          );
      }

      // Verify password
      const isValidPassword = await UserModel.verifyPassword(
        password,
        user.password
      );
      if (!isValidPassword) {
        return res
          .status(401)
          .json(
            errorResponse(
              getTranslation(lang, "common.invalidCredentials"),
              401
            )
          );
      }

      // Generate token
      const token = generateToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      // Remove password from response
      delete user.password;

      res.json(
        successResponse(
          {
            user,
            token,
          },
          getTranslation(lang, "common.success")
        )
      );
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async getMe(req: any, res: Response) {
    try {
      const userId = req.user.id;
      const user = await UserModel.findById(userId);

      if (!user) {
        return res.status(404).json(errorResponse("User not found", 404));
      }

      res.json(successResponse(user));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async updateProfile(req: any, res: Response) {
    try {
      const userId = req.user.id;
      const { name, email, avatar, bio, phone, location, website } = req.body;

      const updated = await UserModel.update(userId, {
        name,
        email,
        avatar,
        bio,
        phone,
        location,
        website,
      });

      if (!updated) {
        return res.status(404).json(errorResponse("User not found", 404));
      }

      const user = await UserModel.findById(userId);
      delete user?.password;

      res.json(successResponse(user, "Profile updated successfully"));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async changePassword(req: any, res: Response) {
    try {
      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;

      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(404).json(errorResponse("User not found", 404));
      }

      // Verify current password
      const isValidPassword = await UserModel.verifyPassword(
        currentPassword,
        user.password!
      );
      if (!isValidPassword) {
        return res
          .status(401)
          .json(errorResponse("Current password is incorrect", 401));
      }

      // Update password
      await UserModel.updatePassword(userId, newPassword);

      res.json(successResponse(null, "Password changed successfully"));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },
};
