const router = require('express').Router();
const { isValidObjectId } = require('mongoose');
const { User, Correction, AuditLog } = require('../models');
const { ROLES, SITE_IDS } = require('../config/constants');
const { authenticate, requireRole } = require('../middleware/auth');
const ml = require('../services/mlClient');
const { E, ah } = require('../utils/errors');
const { z, parse } = require('../utils/validation');
const { toUser } = require('../utils/serialize');

router.use(authenticate, requireRole('admin'));

router.get('/users', ah(async (req, res) => {
  const users = await User.find().sort({ role: 1, name: 1 }).lean();
  res.json({ items: users.map(toUser) });
}));

const patchSchema = z.object({
  role: z.enum(ROLES).optional(),
  siteId: z.enum(SITE_IDS).nullable().optional(),
  active: z.boolean().optional(),
}).strict();

router.patch('/users/:id', ah(async (req, res) => {
  const body = parse(patchSchema, req.body);
  if (!isValidObjectId(req.params.id)) throw E.notFound('User not found');
  const user = await User.findById(req.params.id);
  if (!user) throw E.notFound('User not found');

  const self = user._id.equals(req.user._id);
  if (self && (body.active === false || (body.role && body.role !== 'admin'))) {
    throw E.validation('You cannot deactivate or demote your own admin account');
  }
  const role = body.role ?? user.role;
  const siteId = body.siteId !== undefined ? body.siteId : user.siteId;
  if (role === 'site_supervisor' && !siteId) throw E.validation('siteId is required for site_supervisor');

  user.role = role;
  user.siteId = role === 'site_supervisor' ? siteId : null;
  if (body.active !== undefined) user.active = body.active;
  await user.save();
  res.json({ user: toUser(user) });
}));

// Proxy of ML /metrics + pending reviewer corrections
router.get('/model', ah(async (req, res) => {
  const [metrics, pendingCorrections] = await Promise.all([ml.metrics(), Correction.countDocuments({ used: false })]);
  res.json({ ...metrics, pendingCorrections });
}));

router.post('/retrain', ah(async (req, res) => {
  const pending = await Correction.find({ used: false }).lean();
  const result = await ml.retrain(pending.map((c) => ({
    text: c.text, classification: c.classification, rules: c.rules, barrierFailureType: c.barrierFailureType,
  })));
  if (result?.status !== 'failed' && pending.length) {
    await Correction.updateMany({ _id: { $in: pending.map((c) => c._id) } }, { $set: { used: true } });
  }
  await AuditLog.create({
    action: 'retrain', by: req.user._id, byName: req.user.name,
    detail: `Retrain ${result?.status}: ${pending.length} corrections sent, model ${result?.modelVersion || 'unknown'}`,
  });
  res.json({
    status: result?.status || 'unknown',
    trainedOn: result?.trainedOn ?? pending.length,
    modelVersion: result?.modelVersion,
    metrics: result?.metrics || null,
  });
}));

module.exports = router;
