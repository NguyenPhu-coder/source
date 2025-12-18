import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { errorResponse } from "../utils/response.js";

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
  };
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    console.log("🔐 Auth header:", authHeader ? `${authHeader.substring(0, 20)}...` : "none");

    const token = authHeader?.split(" ")[1];

    if (!token) {
      console.log("❌ No token provided");
      return res
        .status(401)
        .json(errorResponse("Authentication required", 401));
    }

    console.log("🔑 Token length:", token.length, "Token start:", token.substring(0, 20));
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    console.log("✅ Token decoded for user:", decoded.email, "role:", decoded.role);
    req.user = decoded;

    next();
  } catch (error: any) {
    console.error("❌ Authentication error:", error.message);
    return res.status(401).json(errorResponse("Invalid token", 401));
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res
        .status(401)
        .json(errorResponse("Authentication required", 401));
    }

    console.log("🔐 Authorization check:", {
      userRole: req.user.role,
      requiredRoles: roles,
      hasPermission: roles.includes(req.user.role),
    });

    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json(errorResponse("Insufficient permissions", 403));
    }

    next();
  };
};

// Middleware to require admin role
export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json(errorResponse("Authentication required", 401));
  }

  if (req.user.role !== "admin" && req.user.role !== "instructor") {
    return res.status(403).json(errorResponse("Admin access required", 403));
  }

  next();
};

export const generateToken = (payload: any): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
};
