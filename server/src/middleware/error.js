const { AppError } = require('../utils/errors');

const send = (res, status, code, message) => res.status(status).json({ error: { code, message } });

function notFound(req, res) {
  send(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`);
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) return send(res, err.status, err.code, err.message);
  if (err.name === 'MulterError') {
    return send(res, 400, 'VALIDATION_ERROR', err.code === 'LIMIT_FILE_SIZE' ? 'File exceeds the 10 MB limit' : err.message);
  }
  if (err.type === 'entity.parse.failed') return send(res, 400, 'VALIDATION_ERROR', 'Request body is not valid JSON');
  if (err.name === 'CastError' || err.name === 'ValidationError') return send(res, 400, 'VALIDATION_ERROR', err.message);
  if (err.code === 11000) return send(res, 400, 'VALIDATION_ERROR', 'Duplicate value');
  console.error('[error]', err);
  return send(res, 500, 'SERVER_ERROR', 'Something went wrong on the server');
}

module.exports = { notFound, errorHandler };
