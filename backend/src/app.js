import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import passport from 'passport';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config/env.js';
import { sessionMiddleware } from './config/session.js';
import { registerGoogleStrategy } from './providers/google.js';
import authRoutes from './routes/authRoutes.js';
import apiRoutes from './routes/apiRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
const testPagePath = path.resolve(__dirname, '../../xampp-test/auth-test.html');

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    })
  );
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST'],
    })
  );
  app.use(express.json({ limit: '20mb' }));
  app.use(sessionMiddleware);
  app.use(passport.initialize());
  registerGoogleStrategy();

  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/auth', authRoutes);
  app.use('/api', apiRoutes);

  // Standalone test page (running on the same port)
  app.get(['/auth-test.html', '/test', '/xampp-test/auth-test.html'], (req, res) => {
    res.sendFile(testPagePath);
  });

  // Test-only helper so automated tests can create a session without a real provider. Never mounted outside NODE_ENV=test.
  if (config.env === 'test') {
    app.post('/__test/login', (req, res) => {
      req.session.user = req.body.user;
      req.session.loginAt = Date.now() - (req.body.ageMs || 0);
      res.json({ ok: true });
    });
  }

  // React frontend static assets (bundled Vite output)
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
  }

  // React SPA routing fallback for browser navigation (excluding API / Auth routes)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/auth') || req.path.startsWith('/__test')) {
      return next();
    }
    if (config.env !== 'test') {
      const indexPath = path.join(frontendDist, 'index.html');
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
    }
    next();
  });

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
