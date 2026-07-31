import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  // Log the error
  console.error(`[Error] ${err.message}`, process.env.NODE_ENV === 'development' ? err.stack : '');

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      message: err.message,
    });
  }

  // Handle Paystack signature errors
  if (err.message?.includes('Paystack') || err.message?.includes('signature')) {
    return res.status(400).json({
      message: err.message,
    });
  }

  // Handle CORS errors
  if (err.message?.startsWith('CORS')) {
    return res.status(403).json({
      message: err.message,
    });
  }

  // Handle JSON parse errors
  if ((err as any).type === 'entity.parse.failed') {
    return res.status(400).json({
      message: 'Invalid JSON in request body',
    });
  }

  // Default server error - never expose stack traces in production
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Internal server error';

  return res.status(500).json({
    message,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ message: 'Route not found' });
}
