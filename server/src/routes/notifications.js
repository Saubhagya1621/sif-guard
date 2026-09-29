const router = require('express').Router();
const { isValidObjectId } = require('mongoose');
const { Notification } = require('../models');
const { authenticate } = require('../middleware/auth');
const { scopeFilter } = require('../services/scope');
const { E, ah } = require('../utils/errors');
const { toNotification } = require('../utils/serialize');

router.use(authenticate);

router.get('/', ah(async (req, res) => {
  const items = await Notification.find(scopeFilter(req.user)).sort({ createdAt: -1 }).limit(50).lean();
  res.json({ items: items.map(toNotification) });
}));

router.patch('/:id/read', ah(async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw E.notFound('Notification not found');
  const n = await Notification.findOneAndUpdate(
    { _id: req.params.id, ...scopeFilter(req.user) }, { read: true }, { new: true },
  ).lean();
  if (!n) throw E.notFound('Notification not found');
  res.json({ notification: toNotification(n) });
}));

module.exports = router;
