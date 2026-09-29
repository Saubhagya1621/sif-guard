const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const { User } = require('../models');
const { ROLES, SITE_IDS } = require('../config/constants');
const { COOKIE_NAME, cookieOptions, authenticate, requireRole } = require('../middleware/auth');
const { E, ah } = require('../utils/errors');
const { z, parse } = require('../utils/validation');
const { toUser } = require('../utils/serialize');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  handler: (req, res) => res.status(429).json({ error: { code: 'VALIDATION_ERROR', message: 'Too many login attempts, try again in 15 minutes' } }),
});

const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'must be at least 8 characters').max(100),
  role: z.enum(ROLES),
  siteId: z.enum(SITE_IDS).nullable().optional(),
}).superRefine((v, ctx) => {
  if (v.role === 'site_supervisor' && !v.siteId) ctx.addIssue({ code: 'custom', path: ['siteId'], message: 'required for site_supervisor' });
});

router.post('/login', loginLimiter, ah(async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  const user = await User.findOne({ email });
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw E.unauth('Invalid email or password');
  if (!user.active) throw E.forbidden('This account has been deactivated');
  const token = jwt.sign({ sub: user._id.toString(), role: user.role }, env.JWT_SECRET, { expiresIn: '8h' });
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: 8 * 3600 * 1000 });
  res.json({ user: toUser(user) });
}));

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOptions());
  res.json({ ok: true });
});

router.get('/me', authenticate, (req, res) => res.json({ user: toUser(req.user) }));

router.post('/register', authenticate, requireRole('admin'), ah(async (req, res) => {
  const body = parse(registerSchema, req.body);
  if (await User.exists({ email: body.email })) throw E.validation('Email already registered');
  const user = await User.create({
    name: body.name, email: body.email, role: body.role,
    siteId: body.role === 'site_supervisor' ? body.siteId : null,
    passwordHash: await bcrypt.hash(body.password, 10),
  });
  res.status(201).json({ user: toUser(user) });
}));

module.exports = router;
