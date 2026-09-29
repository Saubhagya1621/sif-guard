const app = require('./app');
const env = require('./config/env');
const { connectDB } = require('./config/db');

(async () => {
  try {
    await connectDB();
    app.listen(env.PORT, () => {
      console.log(`[server] SIF-Guard API on http://localhost:${env.PORT}/api  (ML: ${env.ML_SERVICE_URL})`);
    });
  } catch (err) {
    console.error('[server] failed to start:', err.message);
    process.exit(1);
  }
})();
