const path = require('path');
const dotenv = require('dotenv');

// Precedence: real environment > server/.env > repo-root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const list = (v) => v.split(',').map((s) => s.trim()).filter(Boolean);
const bool = (v, d) => (v === undefined || v === '' ? d : ['1', 'true', 'yes'].includes(String(v).toLowerCase()));
const DEV_SECRET = 'dev-only-insecure-secret';

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 5000,
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/sifguard',
  JWT_SECRET: process.env.JWT_SECRET || DEV_SECRET,
  CLIENT_ORIGIN: list(process.env.CLIENT_ORIGIN || 'http://localhost:5173'),
  ML_SERVICE_URL: (process.env.ML_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, ''),
  NOTIFY_THRESHOLD: Number(process.env.NOTIFY_THRESHOLD || 0.85),
  // Cross-site deployments (Vercel client + backend on another domain) need SAMESITE=none + SECURE=true.
  COOKIE_SAMESITE: (process.env.COOKIE_SAMESITE || 'lax').toLowerCase(),
  COOKIE_SECURE: bool(process.env.COOKIE_SECURE, process.env.NODE_ENV === 'production'),
};

if (env.NODE_ENV === 'production' && env.JWT_SECRET === DEV_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}

module.exports = env;
