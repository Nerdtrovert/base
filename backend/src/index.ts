import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { initializeDatabase, checkDbHealth } from '../database/postgres';
import { loggingMiddleware, errorHandler } from '../middleware/auth';
import authRoutes from '../routes/auth';
import syncRoutes from '../routes/sync';
import deviceRoutes from '../routes/devices';
import notificationRoutes from '../routes/notifications';
import { startNotificationScheduler } from '../services/notificationScheduler';

// Load environment variables
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5001;
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

// Initialize database and start server
const startServer = () => {
  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/sync', syncRoutes);
  app.use('/api/devices', deviceRoutes);
  app.use('/api/notifications', notificationRoutes);

  // Health check
  app.get('/api/health', async (req, res) => {
    const isDbConnected = await checkDbHealth();
    res.json({
      status: 'ok',
      database: isDbConnected ? 'connected' : 'disconnected',
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

  // Serve Frontend Static Files (registered AFTER API routes)
  const frontendDistPath = path.resolve(__dirname, '../../../frontend/dist');
  const frontendIndexPath = path.join(frontendDistPath, 'index.html');

  console.log('[Server] Static Files Path Debug:');
  console.log('  - __dirname:', __dirname);
  console.log('  - Resolved frontendDistPath:', frontendDistPath);
  console.log('  - Resolved frontendIndexPath:', frontendIndexPath);
  console.log('  - File index.html exists?:', fs.existsSync(frontendIndexPath));

  if (fs.existsSync(frontendIndexPath)) {
    app.use(express.static(frontendDistPath));

    app.get('*', (req, res) => {
      res.sendFile(frontendIndexPath);
    });
  } else {
    console.warn('[Server] Frontend dist folder not found or index.html missing. serving API only.');
  }

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler
  app.use(errorHandler);

  try {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Base Backend] running at http://0.0.0.0:${PORT}`);
      console.log(`[Environment] ${process.env.NODE_ENV || 'development'}`);
      console.log(`[Frontend] ${FRONTEND_URL}`);
      
      // Initialize database in the background to avoid blocking server start
      console.log('[Database] Starting background initialization...');
      initializeDatabase()
        .then(() => {
          console.log('[Database] Initialization complete');
        })
        .catch(error => {
          console.error('[Database] Initialization failed (running without active db connection):', error);
          console.warn('[Database] Make sure PostgreSQL is running locally or check your network/database connection.');
        });

      // Start notifications scheduler
      startNotificationScheduler();
    });
  } catch (listenError) {
    console.error('[Server] Failed to listen on port:', listenError);
    process.exit(1);
  }
};

startServer();
