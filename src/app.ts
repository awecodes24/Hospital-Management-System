import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { errorHandler } from './middleware/errorHandler';
import { router } from './routes';
import { env } from './config/env';

export const app = express();

// ── Security headers ───────────────────────────────────────────
app.use(helmet());

// ── CORS ───────────────────────────────────────────────────────
app.use(
  cors({
    origin:      env.NODE_ENV === 'production' ? false : '*',
    credentials: true,
  }),
);

// ── Request logging ────────────────────────────────────────────
app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// ── Body parsing ───────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// ── Global rate limiter ────────────────────────────────────────
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max:      200,
    standardHeaders: true,
    legacyHeaders:   false,
    message: { success: false, message: 'Too many requests, please try again later.' },
  }),
);


// ── Health check (no auth needed) ─────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Himalaya Hospital API is running.' });
});



// ── API routes ─────────────────────────────────────────────────
app.use('/api', router);


// ── 404 handler ────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// ── Global error handler (must be last) ───────────────────────
app.use(errorHandler);
