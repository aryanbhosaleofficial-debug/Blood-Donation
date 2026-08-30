'use strict';

/**
 * modules/notifications/notifications.controller
 *
 * Thin controllers: parse, delegate, respond.
 * No business logic or SQL here.
 */

const service = require('./notifications.service');

function list(req, res, next) {
  try {
    res.json({ data: service.list(req.user, req.query) });
  } catch (err) { next(err); }
}

function unreadCount(req, res, next) {
  try {
    res.json({ data: service.unreadCount(req.user) });
  } catch (err) { next(err); }
}

function getOne(req, res, next) {
  try {
    res.json({ data: service.getOne(req.user, req.params.notificationId) });
  } catch (err) { next(err); }
}

function markRead(req, res, next) {
  try {
    res.json({ data: service.markRead(req.user, req.params.notificationId) });
  } catch (err) { next(err); }
}

function listFailed(req, res, next) {
  try {
    res.json({ data: service.listFailed() });
  } catch (err) { next(err); }
}

function requeueFailed(req, res, next) {
  try {
    res.json({ data: service.requeueFailed(req.params.notificationId) });
  } catch (err) { next(err); }
}

module.exports = { list, unreadCount, getOne, markRead, listFailed, requeueFailed };
