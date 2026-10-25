import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import passport from 'passport';
import { config } from './config/env.js';
import { sessionMiddleware } from './config/session.js';
import { registerGoogleStrategy } from './providers/google.js';
import authRoutes from './routes/authRoutes.js';
import apiRoutes from './routes/apiRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();
  if (config.trustProxy) app.set('trust proxy', 1); // needed for secure cookies behind an HTTPS proxy
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(
    cors({
      // Only the React app and the XAMPP test page may call the API from a browser, and only with credentials.
      origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes(origin)),
      credentials: true,
      methods: ['GET', 'POST'],
    })
  );
  app.use(express.json({ limit: '10kb' }));
  app.use(sessionMiddleware);
  app.use(passport.initialize());
  registerGoogleStrategy();

  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/auth', authRoutes);
  app.use('/api', apiRoutes);

  // Test-only helper so automated tests can create a session without a real provider. Never mounted outside NODE_ENV=test.
  if (config.env === 'test') {
    app.post('/__test/login', (req, res) => {
      req.session.user = req.body.user;
      req.session.loginAt = Date.now() - (req.body.ageMs || 0);
      res.json({ ok: true });
    });
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
