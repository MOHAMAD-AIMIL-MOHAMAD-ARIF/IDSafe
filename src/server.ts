import fs from 'fs';
import http from 'http';
import https from 'https';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import csurf from 'csurf';
import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { Pool, PoolConfig } from 'pg';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me';
const isProduction = process.env.NODE_ENV === 'production';
const rpId = process.env.RP_ID || 'localhost';
const rpOrigin = process.env.RP_ORIGIN || `http://localhost:${PORT}`;

const createDatabasePool = (): Pool | null => {
  const { DATABASE_URL, DB_SSL, DB_SSL_REJECT_UNAUTHORIZED, TLS_CA_PATH } =
    process.env;

  if (!DATABASE_URL) {
    console.warn('DATABASE_URL is not set; database pool will not be created.');
    return null;
  }

  const poolConfig: PoolConfig = { connectionString: DATABASE_URL };

  if (DB_SSL === 'true') {
    poolConfig.ssl = {
      rejectUnauthorized: DB_SSL_REJECT_UNAUTHORIZED !== 'false',
      ca: TLS_CA_PATH ? fs.readFileSync(TLS_CA_PATH, 'utf8') : undefined,
    };
  }

  const pool = new Pool(poolConfig);
  pool.on('error', (err) => {
    console.error('Unexpected database error', err);
  });

  return pool;
};

const pool = createDatabasePool();
const app = express();

app.use(helmet());
app.use(
  cors({
    origin: rpOrigin,
    credentials: true,
  }),
);
app.use(compression());
app.use(cookieParser());
app.use(express.json());

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  }),
);

app.use(
  csurf({
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
    },
  }),
);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    rpId,
    rpOrigin,
    csrfToken: req.csrfToken(),
    database: pool ? 'configured' : 'not_configured',
  });
});

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (
      err.name === 'UnauthorizedError' ||
      err.message === 'invalid csrf token'
    ) {
      res.status(403).json({ error: 'Invalid CSRF token' });
      return;
    }

    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  },
);

const startServer = () => {
  const { TLS_KEY_PATH, TLS_CERT_PATH } = process.env;

  if (TLS_KEY_PATH && TLS_CERT_PATH) {
    try {
      const key = fs.readFileSync(TLS_KEY_PATH);
      const cert = fs.readFileSync(TLS_CERT_PATH);
      const httpsServer = https.createServer({ key, cert }, app);
      httpsServer.listen(PORT, () => {
        console.log(`Secure server listening on https://localhost:${PORT}`);
      });
      return;
    } catch (error) {
      console.error(
        'Failed to start HTTPS server, falling back to HTTP:',
        error,
      );
    }
  }

  const httpServer = http.createServer(app);
  httpServer.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
};

startServer();
