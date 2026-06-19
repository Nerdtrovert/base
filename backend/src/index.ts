import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { initializeDatabase } from '../database/postgres';
import { loggingMiddleware, errorHandler } from '../middleware/auth';
import authRoutes from '../routes/auth';
import syncRoutes from '../routes/sync';
import deviceRoutes from '../routes/devices';
import notificationRoutes from '../routes/notifications';
import { startNotificationScheduler } from '../services/notificationScheduler';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const allowedOrigins = [
  FRONTEND_URL.replace(/\/$/, ''),
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    const normalizedOrigin = origin.replace(/\/$/, '');
    if (
      allowedOrigins.includes(normalizedOrigin) ||
      normalizedOrigin.includes('onrender.com') ||
      normalizedOrigin.includes('devtunnels.ms') ||
      normalizedOrigin.startsWith('http://localhost:') ||
      normalizedOrigin.startsWith('http://127.0.0.1:')
    ) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());
app.use(loggingMiddleware);

// Initialize database on startup
const startServer = async () => {
  try {
    await initializeDatabase();
    console.log('[Database] Initialization complete');
  } catch (error) {
    console.error('[Database] Initialization failed:', error);
    process.exit(1);
  }

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/sync', syncRoutes);
  app.use('/api/devices', deviceRoutes);
  app.use('/api/notifications', notificationRoutes);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  });

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      name: 'Base Backend',
      version: '1.0.0',
      description: 'Thin orchestration layer for Base PWA',
      endpoints: {
        auth: '/api/auth',
        sync: '/api/sync',
        devices: '/api/devices',
        health: '/api/health'
      }
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler
  app.use(errorHandler);

  app.listen(PORT, () => {
    console.log(`[Base Backend] running at http://localhost:${PORT}`);
    console.log(`[Environment] ${process.env.NODE_ENV || 'development'}`);
    console.log(`[Frontend] ${FRONTEND_URL}`);
    
    // Start notifications scheduler
    startNotificationScheduler();
  });
};

startServer().catch(error => {
  console.error('[Server] Startup error:', error);
  process.exit(1);
});
