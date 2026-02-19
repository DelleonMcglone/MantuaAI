/**
 * rateLimiter.ts
 * Configures express-rate-limit instances for different endpoint categories.
 *
 * General API:  100 requests per 15 minutes per IP
 * Agent API:    10 requests per minute per IP (AI is expensive)
 * Auth/Verify:  20 requests per 15 minutes per IP
 */

import rateLimit from 'express-rate-limit';

const jsonTooManyRequests = (retryAfter: number) => ({
  error:      'Too many requests.',
  retryAfter,
  message:    `Rate limit exceeded. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
});

/** General rate limit — all /api routes */
export const generalLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             100,
  standardHeaders: true,
  legacyHeaders:   false,
  handler: (_req, res, _next, options) => {
    res.status(429).json(
      jsonTooManyRequests(Math.ceil(options.windowMs / 1000))
    );
  },
});

/** Strict limit for agent endpoints — each call invokes OpenAI + CDP */
export const agentLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  handler: (_req, res, _next, options) => {
    res.status(429).json(
      jsonTooManyRequests(options.windowMs / 1000)
    );
  },
});

/** Auth operations — wallet signature verification */
export const authLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             20,
  standardHeaders: true,
  legacyHeaders:   false,
  handler: (_req, res, _next, options) => {
    res.status(429).json(
      jsonTooManyRequests(Math.ceil(options.windowMs / 1000))
    );
  },
});
