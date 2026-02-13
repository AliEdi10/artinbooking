import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter — applied globally as a safety net.
 * Generous limit for normal authenticated dashboard usage.
 * 200 requests per minute per IP.
 */
export const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many requests. Please try again in a few minutes.',
    },
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health' || req.path === '/';
    },
});

/**
 * Auth rate limiter - stricter limits for login/register/password reset.
 * 10 requests per 15 minutes per IP.
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many authentication attempts. Please try again in 15 minutes.',
    },
});

/**
 * Slot query rate limiter - expensive operation (travel time computation).
 * 30 requests per minute per IP.
 */
export const slotQueryLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many slot queries. Please slow down.',
    },
});

/**
 * Mutation rate limiter - stricter limits for POST/PUT/PATCH/DELETE.
 * Prevents abuse of write operations while keeping reads fast.
 * 60 requests per minute per IP.
 */
export const mutationLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many write requests. Please slow down.',
    },
    // Only apply to mutation methods
    skip: (req) => req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS',
});
