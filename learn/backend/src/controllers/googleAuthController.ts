import { OAuth2Client } from "google-auth-library";
import { Request, Response } from "express";
import { UserModel } from "../models/User.js";
import { successResponse, errorResponse } from "../utils/response.js";
import jwt from "jsonwebtoken";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleLogin = async (req: Request, res: Response) => {
  const { token } = req.body;
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) throw new Error("No email from Google");

    let user = await UserModel.findByEmail(payload.email);
    if (!user) {
      // UserModel.create returns the insertId, need to fetch the user after creation
      const userId = await UserModel.create({
        email: payload.email,
        name: payload.name || "Google User",
        password: "", // Google users don't have password
        avatar: payload.picture,
        role: "student",
      });
      user = await UserModel.findById(userId);
    }
    
    if (!user) {
      throw new Error("Failed to create or find user");
    }

    const jwtToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );
    res.json(successResponse({ token: jwtToken, user }));
  } catch (err) {
    console.error("Google login error:", err);
    res.status(401).json(errorResponse("Google login failed"));
  }
};
