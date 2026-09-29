const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');
const { E } = require('../utils/errors');

const COOKIE_NAME = 'sifguard_token';

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: env.COOKIE_SAMESITE,
  secure: env.COOKIE_SECURE || env.COOKIE_SAMESITE === 'none',
  path: '/',
});

// Reads the JWT cookie, loads the user fresh (so deactivation / role changes apply immediately).
async function authenticate(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) throw E.unauth();
    let payload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch {
      throw E.unauth('Session expired, please log in again');
    }
    const user = await User.findById(payload.sub);
    if (!user || !user.active) throw E.unauth('Account not found or deactivated');
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

const requireRole = (...roles) => (req, res, next) =>
  (req.user && roles.includes(req.user.role) ? next() : next(E.forbidden()));

module.exports = { COOKIE_NAME, cookieOptions, authenticate, requireRole };
