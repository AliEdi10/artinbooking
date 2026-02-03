import pino from 'pino';
import pinoHttp from 'pino-http';

/**
 * Create a structured logger instance
 */
export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    base: {
        env: process.env.NODE_ENV || 'development',
    },
});

/**
 * HTTP request logging middleware
 * Logs method, path, status, response time
 */
export const httpLogger = pinoHttp({
    logger,
    customLogLevel: (req, res, err) => {
        if (res.statusCode >= 500 || err) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
    },
    customSuccessMessage: (req, res) => {
        return `${req.method} ${req.url} ${res.statusCode}`;
    },
    customErrorMessage: (req, res) => {
        return `${req.method} ${req.url} ${res.statusCode}`;
    },
    // Don't log these paths (noisy health checks)
    autoLogging: {
        ignore: (req) => req.url === '/health' || req.url === '/',
    },
    // Add custom attributes to log
    customAttributeKeys: {
        req: 'request',
        res: 'response',
        err: 'error',
        responseTime: 'duration_ms',
    },
    serializers: {
        req: (req) => ({
            method: req.method,
            url: req.url,
            path: req.path,
            query: req.query,
            // Don't log sensitive headers
            headers: {
                'user-agent': req.headers['user-agent'],
                'content-type': req.headers['content-type'],
            },
        }),
        res: (res) => ({
            statusCode: res.statusCode,
        }),
    },
});
