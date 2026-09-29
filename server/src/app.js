const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const env = require('./config/env');
const ml = require('./services/mlClient');
const { ah } = require('./utils/errors');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || env.CLIENT_ORIGIN.includes(origin)),
  credentials: true,
  exposedHeaders: ['Content-Disposition'], // lets the client read the export filename
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api/health', ah(async (req, res) => {
  let mlStatus = 'down';
  try { mlStatus = (await ml.health())?.status || 'ok'; } catch { /* reported as down */ }
  res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'up' : 'down', ml: mlStatus });
}));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/export', require('./routes/export'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
