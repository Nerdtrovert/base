import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyAccessToken } from '../services/auth.service';
import { JWTPayload } from '../models/types';

// Extend Express Request type to include user data
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      deviceId?: string;
    }
  }
}

// Authentication middleware
export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const token = req.headers.authorization?.split('Bearer ')[1];

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const payload = verifyAccessToken(token);

  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  req.user = payload;
  req.deviceId = payload.deviceId;
  next();
};

// Rate limiter by device ID
export const deviceRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  keyGenerator: (req: Request) => req.deviceId || req.ip || 'unknown',
  message: 'Too many requests from this device',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => process.env.NODE_ENV === 'development'
});

// Rate limiter for auth endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per 15 minutes
  keyGenerator: (req: Request) => req.ip || 'unknown',
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter for sync endpoints
export const syncRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // 50 sync requests per minute
  keyGenerator: (req: Request) => req.user?.userId || req.ip || 'unknown',
  message: 'Too many sync requests',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => process.env.NODE_ENV === 'development'
});

// Error handling middleware
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
  console.error('[Error] Uncaught error:', err);

  if (err.status === 401) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (err.status === 403) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  if (err.status === 404) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// Logging middleware
export const loggingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${req.method}] ${req.path} - ${res.statusCode} - ${duration}ms`);
  });

  next();
};
