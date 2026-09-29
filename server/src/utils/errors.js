// Every error leaves the API as { error: { code, message } } (contract §0).
class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const E = {
  unauth: (m = 'Authentication required') => new AppError(401, 'UNAUTHENTICATED', m),
  forbidden: (m = 'You do not have access to this resource') => new AppError(403, 'FORBIDDEN', m),
  notFound: (m = 'Not found') => new AppError(404, 'NOT_FOUND', m),
  validation: (m) => new AppError(400, 'VALIDATION_ERROR', m),
  mlDown: (m = 'ML service unavailable') => new AppError(503, 'ML_UNAVAILABLE', m),
};

// Wrap async route handlers so rejected promises reach the error middleware.
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { AppError, E, ah };
