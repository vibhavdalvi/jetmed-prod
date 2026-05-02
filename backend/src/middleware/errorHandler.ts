import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { IApiResponse } from '../types/index.js';
import config from '../config/index.js';

// Custom error class
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  errors?: any[];

  constructor(message: string, statusCode: number, errors?: any[]) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.errors = errors;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Common error types
export class BadRequestError extends AppError {
  constructor(message = 'Bad request', errors?: any[]) {
    super(message, 400, errors);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors?: any[]) {
    super(message, 422, errors);
  }
}

export class InternalError extends AppError {
  constructor(message = 'Internal server error') {
    super(message, 500);
  }
}

// 404 Not Found handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};

// Global error handler
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  let message = 'Internal server error';
  let errors: any[] | undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors;
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 422;
    message = 'Validation error';
    errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = 'Invalid ID or parameter format';
  } else if ((err as NodeJS.ErrnoException & { code?: number }).code === 11000) {
    statusCode = 409;
    message = 'Resource already exists';
    const keyValue = (err as { keyValue?: Record<string, unknown> }).keyValue;
    if (keyValue) {
      errors = Object.entries(keyValue).map(([field]) => ({
        field,
        message: 'Duplicate value',
      }));
    }
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  } else if (err.name === 'MulterError') {
    statusCode = 400;
    message = (err as any).message || 'File upload error';
  }

  const nestedDbDetail =
    (err as any).parent?.message ||
    (err as any).original?.message ||
    (err as any).sqlMessage;

  const operationalClientError =
    err instanceof AppError && statusCode >= 400 && statusCode < 500;

  // Expected auth/session failures flood logs if logged like 500s; keep full dumps for real failures.
  if (operationalClientError) {
    console.warn('[API]', req.method, req.originalUrl, statusCode, message);
  } else {
    console.error('[API Error]', req.method, req.originalUrl, {
      name: err.name,
      message: err.message,
      ...(nestedDbDetail ? { detail: nestedDbDetail } : {}),
      stack: err.stack?.split('\n').slice(0, 8).join('\n'),
    });
  }

  // Send error response
  const response: IApiResponse = {
    success: false,
    message,
    errors,
  };

  // Include stack trace in development
  if (config.app.env === 'development' && err.stack) {
    (response as any).stack = err.stack;
  }

  // Temporary remote debugging: set EXPOSE_SERVER_ERRORS=true on Render, hit endpoint, then REMOVE (leaks SQL/details)
  if (process.env.EXPOSE_SERVER_ERRORS === 'true') {
    (response as any).debugMessage = err.message;
    if (nestedDbDetail) (response as any).debugDetail = String(nestedDbDetail);
  }

  res.status(statusCode).json(response);
};

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void | Response>;

/** Wraps async route handlers so rejected promises reach `errorHandler`. */
export const asyncHandler = (fn: AsyncRequestHandler) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
