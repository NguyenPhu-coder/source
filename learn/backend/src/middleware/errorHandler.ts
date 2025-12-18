import { Request, Response, NextFunction } from "express";
import { errorResponse } from "../utils/response.js";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.error("Error:", err);

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error";

  res.status(statusCode).json(errorResponse(message, statusCode));
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json(errorResponse("Route not found", 404));
};


