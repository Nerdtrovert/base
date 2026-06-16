"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loggingMiddleware = exports.errorHandler = exports.syncRateLimiter = exports.authRateLimiter = exports.deviceRateLimiter = exports.authMiddleware = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const auth_service_1 = require("../services/auth.service");
// Authentication middleware
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const payload = (0, auth_service_1.verifyAccessToken)(token);
    if (!payload) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
    }
    req.user = payload;
    req.deviceId = payload.deviceId;
    next();
};
exports.authMiddleware = authMiddleware;
// Rate limiter by device ID
exports.deviceRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    keyGenerator: (req) => req.deviceId || req.ip || 'unknown',
    message: 'Too many requests from this device',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => process.env.NODE_ENV === 'development'
});
// Rate limiter for auth endpoints
exports.authRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per 15 minutes
    keyGenerator: (req) => req.ip || 'unknown',
    message: 'Too many authentication attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false
});
// Rate limiter for sync endpoints
exports.syncRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 50, // 50 sync requests per minute
    keyGenerator: (req) => req.user?.userId || req.ip || 'unknown',
    message: 'Too many sync requests',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => process.env.NODE_ENV === 'development'
});
// Error handling middleware
const errorHandler = (err, req, res, next) => {
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
exports.errorHandler = errorHandler;
// Logging middleware
const loggingMiddleware = (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${req.method}] ${req.path} - ${res.statusCode} - ${duration}ms`);
    });
    next();
};
exports.loggingMiddleware = loggingMiddleware;
