// Thin client for the FastAPI ML service (contract §3). Server-to-server only.
const axios = require('axios');
const env = require('../config/env');
const { AppError } = require('../utils/errors');

const http = axios.create({ baseURL: env.ML_SERVICE_URL, timeout: 60000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, url, data, { timeout = 60000, retries = 1 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await http.request({ method, url, data, timeout });
      return res.data;
    } catch (err) {
      const retriable = !err.response || err.response.status >= 500;
      if (attempt < retries && retriable) { await sleep(500); continue; }
      const d = err.response?.data;
      const detail = d?.error?.message || d?.detail || err.message;
      throw new AppError(503, 'ML_UNAVAILABLE', `ML service error on ${url}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
    }
  }
}

module.exports = {
  health: () => call('get', '/health', undefined, { timeout: 3000, retries: 0 }),
  classify: (reports) => call('post', '/classify', { reports }),
  tagRules: (reports) => call('post', '/tag-rules', { reports }),
  cluster: (reports) => call('post', '/cluster', { reports }, { timeout: 120000 }),
  retrain: (corrections) => call('post', '/retrain', { corrections }, { timeout: 600000, retries: 0 }),
  metrics: () => call('get', '/metrics', undefined, { timeout: 5000 }),
};
