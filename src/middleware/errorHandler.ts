import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';

// Custom app error — throw this anywhere in controllers
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Zod validation error
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Validation error',
      errors:  err.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    });
    return;
  }

  // Known app error
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  // MySQL duplicate entry
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'ER_DUP_ENTRY'
  ) {
    res.status(409).json({
      success: false,
      message: 'A record with that value already exists.',
    });
    return;
  }

  // Unknown error — log full detail in dev, hide in prod
  console.error('Unhandled error:', err);

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(env.NODE_ENV === 'development' && {
      detail: err instanceof Error ? err.message : String(err),
    }),
  });
}
